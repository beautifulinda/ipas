import { polygonContains } from 'd3-polygon'
import * as THREE from 'three'
import type { Point } from '~/utils/islandLayout'

// 圓潤的島嶼地形：海岸像饅頭邊緣一樣圓滑隆起，內陸有起伏的小丘，整座島中間略高
// 高度只看「離海岸多遠」與幾道正弦波，同一份版面每次都長得一樣

const SPACING = 6
// 海岸隆起到內陸高度所需的距離
const SHORE = 28
const BASE_HEIGHT = 15
const DOME = 20
// 城鎮周圍整平的半徑，建築才不會一半懸空
const FLAT_RADIUS = 14
export const SAND_LEVEL = 3

// 海岸線上離 p 最近的點
function nearestOnCoast(coast: Point[], p: Point): Point {
  let best: Point = coast[0]
  let min = Infinity
  for (let i = 0; i < coast.length; i++) {
    const a = coast[i]
    const b = coast[(i + 1) % coast.length]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
    const q: Point = [a[0] + t * dx, a[1] + t * dy]
    const d = Math.hypot(p[0] - q[0], p[1] - q[1])
    if (d < min) {
      min = d
      best = q
    }
  }
  return best
}

// 到海岸線的帶號距離：島內為正、島外為負
function signedDistance(coast: Point[], p: Point) {
  const q = nearestOnCoast(coast, p)
  const d = Math.hypot(p[0] - q[0], p[1] - q[1])
  return polygonContains(coast, p) ? d : -d
}

const smoothstep = (t: number) => {
  const k = Math.max(0, Math.min(1, t))
  return k * k * (3 - 2 * k)
}

export interface Terrain {
  heightAt: (p: Point) => number
  // 依地區分好的三角面，key 是地區 id；沙灘與海岸斜坡用 shoreKey
  meshes: Map<string, THREE.Mesh>
  // 每個地區最高點，雲霧要飄在這上面
  peaks: Map<string, number>
}

export interface TerrainRegion {
  id: string
  polygon: Point[]
  color: string
}

export function buildTerrain(
  coast: Point[],
  radius: number,
  regions: TerrainRegion[],
  towns: Point[],
  colors: { sand: string; shoreKey: string },
  random: () => number,
): Terrain {
  const phase = [random(), random(), random(), random()].map((v) => v * Math.PI * 2)

  function rawHeight(p: Point) {
    const d = signedDistance(coast, p)
    // 海岸外往下沉到海底；海岸內用四分之一正弦，邊緣圓滑隆起
    if (d < 0) return d * 0.9
    const shoulder = BASE_HEIGHT * Math.sin((Math.min(1, d / SHORE) * Math.PI) / 2)
    const [x, z] = p
    const rolling =
      5 * Math.sin(x * 0.026 + phase[0]) * Math.sin(z * 0.022 + phase[1]) +
      2.4 * Math.sin(x * 0.058 + z * 0.044 + phase[2]) +
      1.2 * Math.sin(z * 0.09 - x * 0.03 + phase[3])
    // 中間隆起用 sin 曲線，頂部圓、邊緣緩
    const dome = DOME * Math.sin((Math.min(1, d / (radius * 0.75)) * Math.PI) / 2)
    return shoulder + dome + (rolling + 2.5) * smoothstep(d / (SHORE * 1.4))
  }

  // 城鎮附近整平成一小塊平台
  const townHeights = towns.map((t) => [t, rawHeight(t)] as const)
  function heightAt(p: Point) {
    let h = rawHeight(p)
    for (const [t, th] of townHeights) {
      const k = smoothstep((Math.hypot(p[0] - t[0], p[1] - t[1]) - FLAT_RADIUS * 0.5) / FLAT_RADIUS)
      h = th + (h - th) * k
    }
    return h
  }

  // 三角形網格：每列錯開半格，頂點再稍微晃動，看起來像手捏的低多邊形
  const xs = coast.map((p) => p[0])
  const zs = coast.map((p) => p[1])
  const x0 = Math.min(...xs) - 12
  const x1 = Math.max(...xs) + 12
  const z0 = Math.min(...zs) - 12
  const z1 = Math.max(...zs) + 12
  const rowStep = SPACING * 0.866
  const cols = Math.ceil((x1 - x0) / SPACING) + 2
  const rows = Math.ceil((z1 - z0) / rowStep) + 1
  const grid: THREE.Vector3[][] = []
  for (let r = 0; r < rows; r++) {
    const row: THREE.Vector3[] = []
    for (let c = 0; c < cols; c++) {
      let x = x0 + c * SPACING + (r % 2 ? SPACING / 2 : 0) + (random() - 0.5) * SPACING * 0.3
      let z = z0 + r * rowStep + (random() - 0.5) * SPACING * 0.3
      // 靠近海岸的頂點吸到海岸線上，水面交界才是平滑曲線，不會是鋸齒
      const q = nearestOnCoast(coast, [x, z])
      if (Math.hypot(x - q[0], z - q[1]) < SPACING * 0.45) [x, z] = q
      row.push(new THREE.Vector3(x, heightAt([x, z]), z))
    }
    grid.push(row)
  }

  const groups = new Map<string, { positions: number[]; colors: number[] }>()
  const peaks = new Map<string, number>()
  const color = new THREE.Color()
  const hsl = { h: 0, s: 0, l: 0 }
  const regionColors = new Map(regions.map((r) => [r.id, new THREE.Color(r.color)]))
  const sand = new THREE.Color(colors.sand)

  function addTriangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
    // 整個沉在海裡的面不用畫
    if (Math.max(a.y, b.y, c.y) < -2) return
    const centroid: Point = [(a.x + b.x + c.x) / 3, (a.z + b.z + c.z) / 3]
    const low = Math.min(a.y, b.y, c.y) < SAND_LEVEL
    const region = low ? undefined : regions.find((r) => polygonContains(r.polygon, centroid))
    // 三個頂點不全在同一個地區，就是地區交界，顏色壓深一點當分界線
    const border = region && [a, b, c].some((v) => !polygonContains(region.polygon, [v.x, v.z]))
    const key = region?.id ?? colors.shoreKey
    let group = groups.get(key)
    if (!group) groups.set(key, (group = { positions: [], colors: [] }))
    // 每一面顏色略有深淺，做出低多邊形的面感
    color.copy(region ? regionColors.get(region.id)! : sand).getHSL(hsl)
    color.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * (border ? 0.72 : 1) + (random() - 0.5) * 0.05)))
    // 法線要朝上：(b-a)×(c-a) 的 y 分量為負就把頂點順序反過來
    const up = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z) > 0
    for (const v of up ? [a, b, c] : [a, c, b]) {
      group.positions.push(v.x, v.y, v.z)
      group.colors.push(color.r, color.g, color.b)
    }
    if (region) peaks.set(region.id, Math.max(peaks.get(region.id) ?? 0, a.y, b.y, c.y))
  }

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const top = grid[r]
      const bottom = grid[r + 1]
      // 奇數列往右錯半格，三角形的切法跟著換邊
      if (r % 2 === 0) {
        addTriangle(top[c], bottom[c], top[c + 1])
        addTriangle(top[c + 1], bottom[c], bottom[c + 1])
      } else {
        addTriangle(top[c], bottom[c], bottom[c + 1])
        addTriangle(top[c], bottom[c + 1], top[c + 1])
      }
    }
  }

  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  const meshes = new Map<string, THREE.Mesh>()
  for (const [key, group] of groups) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(group.positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(group.colors, 3))
    geometry.computeVertexNormals()
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    meshes.set(key, mesh)
  }
  return { heightAt, meshes, peaks }
}
