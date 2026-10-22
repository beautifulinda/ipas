import { polygonCentroid, polygonContains } from 'd3-polygon'
import polygonClipping from 'polygon-clipping'
import * as THREE from 'three'
import { seededRandom, type BBox, type Point, type WorldLayout } from '~/utils/islandLayout'
import type { Progression, TownLevel } from '~/utils/progression'
import { makeBuilding, type BuildingTick } from '~/utils/scene/buildings'
import {
  makeCloud,
  makeFlag,
  makeHill,
  makeLighthouse,
  makeMountain,
  makePine,
  makeTree,
  makeDustRing,
  mat,
  setLighthouseLit,
  type Effect,
} from '~/utils/scene/models'
import { THEMES_3D } from '~/utils/scene/palette'

// 座標換算：版面的平面座標 (x, y) → 3D 世界 (x, 高度, z=y)
export const SAND_TOP = 8
const BASE_BOTTOM = -8
const REGION_HEIGHTS = [3, 5.5, 4, 6.5, 3.5]

// 可點擊的物件都帶 userData.nodeId
export interface Pickable extends THREE.Object3D {
  userData: { nodeId: string }
}

export interface World3D {
  root: THREE.Group
  pickables: THREE.Object3D[]
  // 每個節點的範圍（平面座標），鏡頭用來決定要框住哪裡
  bounds: Map<string, BBox>
  // 文字標籤的 3D 錨點
  anchors: Map<string, THREE.Vector3>
  townPosition: (id: string) => THREE.Vector3
  // 目前建築的高度（城堡約 40，比其他建築高很多），箭頭與煙火要放在建築上方
  townHeight: (id: string) => number
  regionFlagPosition: (id: string) => THREE.Vector3
  lighthousePosition: (id: string) => THREE.Vector3
  applyProgression: (progression: Progression, animate: boolean) => void
  // motion 為 false（系統開啟減少動態效果）時，建築上會動的零件停在原位
  animate: (time: number, dt: number, motion: boolean) => void
}

// d3 / polygon-clipping 的多邊形 → three.js 的 Shape（平面 y 對應世界 z，所以 Shape 用 -y）
function shapeFromRing(ring: Point[], holes: Point[][] = []) {
  const shape = new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, -y)))
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, -y))))
  return shape
}

// 擠出成立體陸塊：頂面與側面用不同材質，躺平後頂面朝上
function extrude(shapes: THREE.Shape[], depth: number, top: THREE.Material, side: THREE.Material, bottomY: number) {
  const geometry = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 1 })
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, bottomY, 0)
  const mesh = new THREE.Mesh(geometry, [top, side])
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function bboxOf(points: Point[]): BBox {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

function scaleToward(points: Point[], center: Point, factor: number): Point[] {
  return points.map(([x, y]) => [center[0] + (x - center[0]) * factor, center[1] + (y - center[1]) * factor])
}

export function buildWorld3D(world: WorldLayout): World3D {
  const root = new THREE.Group()
  const pickables: THREE.Object3D[] = []
  const bounds = new Map<string, BBox>()
  const anchors = new Map<string, THREE.Vector3>()
  const regionTop = new Map<string, number>()
// 建築換代的動畫：舊建築縮進塵土（0.25 秒），新建築回彈長出（0.7 秒）
  interface Swap {
    old?: THREE.Object3D
    oldScale: number
    scale: number
    t: number
  }
  const towns = new Map<string, { group: THREE.Group; level: TownLevel | -1; position: THREE.Vector3; height: number; swap?: Swap }>()
  const effects: Effect[] = []
  const fogs = new Map<string, { group: THREE.Group; fading: number }>()
  const flags = new Map<string, { flag: THREE.Group; position: THREE.Vector3; raising: number }>()
  const lighthouses = new Map<string, { group: THREE.Group; position: THREE.Vector3 }>()

  world.islands.forEach((island) => {
    const theme = THEMES_3D[island.palette % THEMES_3D.length]
    const random = seededRandom(`${island.id}:3d`)
    const coast = island.coast
    const center = polygonCentroid(coast) as Point
    const radius = Math.sqrt(Math.abs(coast.reduce((sum, p, i) => {
      const q = coast[(i + 1) % coast.length]
      return sum + p[0] * q[1] - q[0] * p[1]
    }, 0)) / 2 / Math.PI)
    const islandGroup = new THREE.Group()

    // 島的底座：沙灘頂面＋岩壁側面，一路延伸到海面下
    const base = extrude([shapeFromRing(coast)], SAND_TOP - BASE_BOTTOM, mat(theme.sand), mat(theme.rock), BASE_BOTTOM)
    base.userData.nodeId = island.id
    islandGroup.add(base)
    pickables.push(base)

    // 白色浪花圈
    const foam = new THREE.Mesh(
      new THREE.ShapeGeometry(shapeFromRing(scaleToward(coast, center, 1 + 7 / radius), [coast.slice().reverse()])),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75 }),
    )
    foam.geometry.rotateX(-Math.PI / 2)
    foam.position.y = 0.6
    islandGroup.add(foam)

    // 地區：沙灘內側的草地台階，各地區高度略有不同
    const inner = scaleToward(coast, center, 1 - 10 / radius)
    const regions = world.regions.filter((r) => r.islandId === island.id)
    let islandBox: BBox = bboxOf(coast)
    for (const region of regions) {
      const clipped = polygonClipping.intersection([region.polygon], [inner]) as Point[][][]
      if (!clipped.length) continue
      const height = REGION_HEIGHTS[region.color % REGION_HEIGHTS.length]
      regionTop.set(region.id, SAND_TOP + height)
      const shapes = clipped.map(([outer, ...holes]) => shapeFromRing(outer, holes))
      const land = extrude(shapes, height, mat(theme.land[region.color % theme.land.length]), mat(theme.landSide), SAND_TOP)
      land.userData.nodeId = region.id
      islandGroup.add(land)
      pickables.push(land)
      bounds.set(region.id, bboxOf(clipped.flatMap(([outer]) => outer)))
      anchors.set(region.id, new THREE.Vector3(region.labelFlat[0], SAND_TOP + height + 2, region.labelFlat[1]))

      // 雲霧：還沒練習過的地區蓋著一層白霧，上面再飄幾朵雲
      const fog = new THREE.Group()
      const mist = new THREE.Mesh(
        new THREE.ShapeGeometry(shapes),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }),
      )
      mist.geometry.rotateX(-Math.PI / 2)
      mist.position.y = SAND_TOP + height + 1.5
      fog.add(mist)
      const box = bounds.get(region.id)!
      const cloudCount = Math.max(3, Math.round(((box[2] - box[0]) * (box[3] - box[1])) / 2200))
      for (let i = 0, attempt = 0; i < cloudCount && attempt < cloudCount * 6; attempt++) {
        const x = box[0] + random() * (box[2] - box[0])
        const z = box[1] + random() * (box[3] - box[1])
        if (!polygonContains(region.polygon, [x, z]) || !polygonContains(coast, [x, z])) continue
        const cloud = makeCloud(random)
        cloud.position.set(x, SAND_TOP + height + 30 + random() * 10, z)
        fog.add(cloud)
        i++
      }
      islandGroup.add(fog)
      fogs.set(region.id, { group: fog, fading: -1 })

      // 旗子位置：地區名稱旁邊，完成時才升起
      const flag = makeFlag()
      const flagPosition = new THREE.Vector3(region.labelFlat[0] + 14, SAND_TOP + height, region.labelFlat[1] - 6)
      flag.position.copy(flagPosition)
      flag.visible = false
      islandGroup.add(flag)
      flags.set(region.id, { flag, position: flagPosition, raising: -1 })
    }
    const regionAt = (p: Point) => regions.find((r) => polygonContains(r.polygon, p))
    const groundAt = (p: Point) => regionTop.get(regionAt(p)?.id ?? '') ?? SAND_TOP

    // 山、山丘與樹
    for (const item of world.decor.filter((d) => d.islandId === island.id)) {
      const model =
        item.kind === 'mountain'
          ? makeMountain(theme, random)
          : item.kind === 'hill'
            ? makeHill(theme, random)
            : item.kind === 'pine'
              ? makePine(theme, random)
              : makeTree(theme, random)
      model.position.set(item.flat[0], groundAt(item.flat) - 0.5, item.flat[1])
      islandGroup.add(model)
    }

    // 城鎮：建築依熟練度替換
    for (const town of world.towns.filter((t) => t.islandId === island.id)) {
      const group = new THREE.Group()
      const position = new THREE.Vector3(town.flat[0], groundAt(town.flat), town.flat[1])
      group.position.copy(position)
      group.userData.nodeId = town.id
      islandGroup.add(group)
      pickables.push(group)
      towns.set(town.id, { group, level: -1, position, height: 0 })
      bounds.set(town.id, [town.flat[0] - 45, town.flat[1] - 45, town.flat[0] + 45, town.flat[1] + 45])
      anchors.set(town.id, position.clone().add(new THREE.Vector3(0, 12, 0)))
    }

    // 燈塔：放在島最前方（z 最大）的海岸附近
    const front = coast.reduce((best, p) => (p[1] > best[1] ? p : best), coast[0])
    const spot = scaleToward([front], center, 1 - 14 / radius)[0]
    const lighthouse = makeLighthouse()
    const lighthousePosition = new THREE.Vector3(spot[0], SAND_TOP, spot[1])
    lighthouse.position.copy(lighthousePosition)
    islandGroup.add(lighthouse)
    lighthouses.set(island.id, { group: lighthouse, position: lighthousePosition })

    islandBox = bboxOf(coast)
    bounds.set(island.id, islandBox)
    // 島名錨點：島的最後緣上方（標籤會畫在這個點的上面）
    anchors.set(island.id, new THREE.Vector3((islandBox[0] + islandBox[2]) / 2, SAND_TOP + 4, islandBox[1]))
    root.add(islandGroup)
  })

  const islandBoxes = world.islands.map((island) => bounds.get(island.id)!)
  bounds.set(
    'root',
    islandBoxes.length
      ? [
          Math.min(...islandBoxes.map((b) => b[0])),
          Math.min(...islandBoxes.map((b) => b[1])),
          Math.max(...islandBoxes.map((b) => b[2])),
          Math.max(...islandBoxes.map((b) => b[3])),
        ]
      : [-100, -100, 100, 100],
  )

  function applyProgression(progression: Progression, animate: boolean) {
    for (const [id, town] of towns) {
      const level = progression.townLevels.get(id) ?? 0
      if (level === town.level) continue
      const building = makeBuilding(level)
      // 放進地圖前量，量到的是建築本身的高度，不含地面高度與升級動畫的縮放
      town.height = new THREE.Box3().setFromObject(building).max.y
      // 只有升級才播換代動畫；降級、第一次載入、減少動態效果時直接換掉
      const old = animate && town.level >= 0 && level > town.level ? town.group.children[0] : undefined
      town.group.clear()
      town.group.add(building)
      town.swap = undefined
      if (old) {
        town.group.add(old)
        town.swap = { old, oldScale: old.scale.x, scale: building.scale.x, t: 0 }
        building.scale.setScalar(0.001)
      }
      town.level = level
    }
    for (const [id, fog] of fogs) {
      const explored = progression.exploredRegions.has(id)
      if (!explored) {
        fog.group.visible = true
        fog.group.scale.setScalar(1)
        fog.fading = -1
      } else if (fog.group.visible) {
        if (animate) fog.fading = 0
        else fog.group.visible = false
      }
    }
    for (const [id, flag] of flags) {
      const done = progression.flaggedRegions.has(id)
      if (done && !flag.flag.visible) {
        flag.flag.visible = true
        flag.raising = animate ? 0 : 1
        flag.flag.scale.y = animate ? 0.01 : 1
      } else if (!done) {
        flag.flag.visible = false
      }
    }
    for (const [id, lighthouse] of lighthouses) setLighthouseLit(lighthouse.group, progression.litIslands.has(id))
  }

  function animateSwap(town: { group: THREE.Group; level: TownLevel | -1; position: THREE.Vector3; swap?: Swap }, dt: number) {
    const swap = town.swap!
    swap.t += dt
    if (swap.old) {
      const k = Math.min(1, swap.t / 0.25)
      swap.old.scale.setScalar(swap.oldScale * (1 - k))
      if (k < 1) return
      swap.old.removeFromParent()
      swap.old = undefined
      const dust = makeDustRing(town.position, town.level === 3 ? 15 : 10)
      root.add(dust.object)
      effects.push(dust)
    }
    // 彈簧曲線：衝過頭再回彈，長出時略為拉高
    const k = Math.min(1, (swap.t - 0.25) / 0.7)
    const s = 1 - Math.cos(k * Math.PI * 2.5) * Math.exp(-k * 5)
    const building = town.group.children[0]
    building.scale.set(swap.scale * s, swap.scale * Math.max(0.05, s * (1 + Math.sin(k * Math.PI) * 0.12)), swap.scale * s)
    if (k >= 1) {
      building.scale.setScalar(swap.scale)
      town.swap = undefined
    }
  }

  function animateWorld(time: number, dt: number, motion: boolean) {
    for (let i = effects.length - 1; i >= 0; i--) {
      if (effects[i].update(dt)) continue
      effects[i].object.removeFromParent()
      effects[i].dispose()
      effects.splice(i, 1)
    }
    for (const town of towns.values()) {
      if (town.swap) animateSwap(town, dt)
      ;(town.group.children[0]?.userData.tick as BuildingTick | undefined)?.(time, dt, motion)
    }
    for (const fog of fogs.values()) {
      if (fog.fading < 0 || !fog.group.visible) continue
      fog.fading += dt
      const t = Math.min(1, fog.fading / 1.2)
      for (const child of fog.group.children) {
        if (child === fog.group.children[0]) continue
        child.scale.setScalar(1 + t * 0.6)
        child.position.y += dt * 20
      }
      fog.group.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined
        if (!m) return
        // 記住原本的透明度，淡出時依比例遞減
        m.userData.baseOpacity ??= m.opacity
        m.opacity = m.userData.baseOpacity * (1 - t)
      })
      if (t >= 1) {
        fog.group.visible = false
        fog.fading = -1
      }
    }
    for (const fog of fogs.values()) {
      // 雲輕輕飄動
      if (fog.group.visible) fog.group.children.forEach((c, i) => i > 0 && (c.position.x += Math.sin(time * 0.4 + i) * dt * 2))
    }
    for (const flag of flags.values()) {
      if (!flag.flag.visible) continue
      if (flag.raising >= 0 && flag.raising < 1) {
        flag.raising = Math.min(1, flag.raising + dt * 1.5)
        flag.flag.scale.y = flag.raising
      }
      const cloth = flag.flag.getObjectByName('cloth')
      if (cloth) cloth.rotation.y = Math.sin(time * 3) * 0.25
    }
    for (const lighthouse of lighthouses.values()) {
      const beam = lighthouse.group.getObjectByName('beam')
      if (beam?.visible) beam.rotation.y = time * 1.2
    }
  }

  return {
    root,
    pickables,
    bounds,
    anchors,
    townPosition: (id) => towns.get(id)?.position.clone() ?? new THREE.Vector3(),
    townHeight: (id) => towns.get(id)?.height ?? 0,
    regionFlagPosition: (id) => flags.get(id)?.position.clone().add(new THREE.Vector3(0, 26, 0)) ?? new THREE.Vector3(),
    lighthousePosition: (id) => lighthouses.get(id)?.position.clone().add(new THREE.Vector3(0, 36, 0)) ?? new THREE.Vector3(),
    applyProgression,
    animate: animateWorld,
  }
}
