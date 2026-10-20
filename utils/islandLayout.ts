import { hierarchy, packSiblings, type HierarchyNode } from 'd3-hierarchy'
import { polygonArea, polygonCentroid, polygonContains, polygonHull } from 'd3-polygon'
import { curveCatmullRomClosed, line } from 'd3-shape'
import { voronoiTreemap } from 'd3-voronoi-treemap'
import type { MapNode } from '~/utils/mapTree'
import { PX, SPRITE_SIZE, snap } from '~/utils/pixelArt'

export type Point = [number, number]
// [x0, y0, x1, y1]
export type BBox = [number, number, number, number]

// 科目：一座島
export interface IslandShape {
  id: string
  data: MapNode
  // 海岸線（平面座標），像素化時用來判斷每一格是不是陸地
  coast: Point[]
  // 島的表面（抬高後）
  path: string
  // 海平面上的島底輪廓，用來畫淺灘與陰影
  basePath: string
  // 表面與島底之間的岩壁側面
  cliffPath: string
  // 岩壁上緣的草皮帶、下緣的深色岩層帶
  lipPath: string
  bedrockPath: string
  palette: number
}

// 大知識分類：島上的一個地區
export interface RegionShape {
  id: string
  islandId: string
  data: MapNode
  path: string
  // 地區範圍（平面座標）
  polygon: Point[]
  label: Point
  color: number
}

// 主題概念：地區裡的一個城鎮
export interface TownShape {
  id: string
  islandId: string
  regionId: string
  data: MapNode
  x: number
  y: number
}

// 島上的裝飾：樹（圓樹、針葉樹）、山丘與山，只用來美化，不能點
export interface DecorShape {
  islandId: string
  kind: 'tree' | 'pine' | 'hill' | 'mountain'
  x: number
  y: number
  size: number
}

export interface WorldLayout {
  islands: IslandShape[]
  regions: RegionShape[]
  towns: TownShape[]
  decor: DecorShape[]
  // 海面上的浪花位置（斜俯視座標）
  waves: Point[]
  // 每個節點（含根節點）的範圍，縮放時用來決定畫面要框住哪裡
  bounds: Map<string, BBox>
}

// 島的面積與底下的概念數量成正比：半徑 = √數量 × ISLAND_UNIT
const ISLAND_UNIT = 100
// 島與島之間的海面寬度
const SEA_GAP = 40
const COAST_POINTS = 120
// 斜俯視：垂直方向壓扁成 TILT 倍，島的表面再往上抬 ELEVATION
export const TILT = 0.62
export const ELEVATION = 24

type PolygonNode = HierarchyNode<MapNode> & { polygon?: Point[] }

function hashString(text: string) {
  let hash = 2166136261
  for (const ch of text) {
    hash ^= ch.codePointAt(0)!
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

// 以字串為種子的亂數（mulberry32），同一個 ID 每次都產生同樣的形狀
export function seededRandom(seed: string) {
  let state = hashString(seed)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 沿圓周平滑內插的隨機雜訊，首尾相接（角度 0 與 2π 的值相同）
function periodicNoise(count: number, random: () => number) {
  const values = Array.from({ length: count }, () => random() * 2 - 1)
  return (angle: number) => {
    const pos = (angle / (Math.PI * 2)) * count
    const i = Math.floor(pos)
    const t = pos - i
    const smooth = t * t * (3 - 2 * t)
    const a = values[i % count]
    const b = values[(i + 1) % count]
    return a + (b - a) * smooth
  }
}

// 疊加三層雜訊：大致輪廓、海灣與岬角、細碎岸線，做出不規則的海岸線
function coastline(cx: number, cy: number, r: number, random: () => number): Point[] {
  const octaves = [
    { noise: periodicNoise(4, random), amp: 0.26 },
    { noise: periodicNoise(9, random), amp: 0.13 },
    { noise: periodicNoise(23, random), amp: 0.04 },
  ]
  // 稍微拉長或壓扁並旋轉，讓每座島的輪廓比例不同
  const stretch = 0.8 + random() * 0.4
  const rotation = random() * Math.PI
  return Array.from({ length: COAST_POINTS }, (_, i) => {
    const angle = (i / COAST_POINTS) * Math.PI * 2
    const f = 1 + octaves.reduce((sum, o) => sum + o.amp * o.noise(angle), 0)
    const px = Math.cos(angle) * r * 0.85 * f * stretch
    const py = (Math.sin(angle) * r * 0.85 * f) / stretch
    return [
      cx + px * Math.cos(rotation) - py * Math.sin(rotation),
      cy + px * Math.sin(rotation) + py * Math.cos(rotation),
    ]
  })
}

function bboxOf(points: Point[]): BBox {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

function intersect(a: BBox, b: BBox): BBox {
  return [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]
}

function union(boxes: BBox[]): BBox {
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ]
}

// 地區是在海岸線的凸包內切出來的，重心可能落在海上；落在海上時往島中心拉回陸地
function pullInside(point: Point, coast: Point[], center: Point): Point {
  for (let step = 0; step <= 10; step++) {
    const t = step / 10
    const p: Point = [point[0] + (center[0] - point[0]) * t, point[1] + (center[1] - point[1]) * t]
    if (polygonContains(coast, p)) return p
  }
  return center
}

// 平面座標投影成斜俯視座標：top 為島的表面，base 為海平面
const top = (p: Point): Point => [p[0], p[1] * TILT - ELEVATION]
const base = (p: Point): Point => [p[0], p[1] * TILT]

const polygonPath = (points: Point[]) => `M${points.map((p) => p.join(',')).join('L')}Z`
const smoothPath = line().curve(curveCatmullRomClosed)

// 常態分布亂數（Box-Muller），讓樹林往群聚中心集中
function gaussian(random: () => number) {
  const u = Math.max(random(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

// 裝飾的大小依像素圖案而定：size 是半寬，decorHeight 是高度（地圖座標）
const decorSize = (kind: DecorShape['kind']) => (SPRITE_SIZE[kind].w * PX) / 2
const decorHeight = (kind: DecorShape['kind']) => SPRITE_SIZE[kind].h * PX

// 在島上先放幾座卡通化的大山、山丘，再撒幾群樹林
// 山的比例刻意誇大（約島寬的四分之一），並避開城鎮與地區名稱，也不壓到海灘
function scatterDecor(
  islandId: string,
  coast: Point[],
  center: Point,
  avoid: Point[],
  random: () => number,
): DecorShape[] {
  const inner = coast.map((p): Point => [center[0] + (p[0] - center[0]) * 0.8, center[1] + (p[1] - center[1]) * 0.8])
  const area = Math.abs(polygonArea(coast))
  const radius = Math.sqrt(area / Math.PI)
  const placed: DecorShape[] = []

  // 圖示在平面座標上佔的範圍：底部在 (x, y)，往畫面上方延伸，換回平面座標要除以 TILT
  const footprint = (d: Pick<DecorShape, 'kind' | 'x' | 'y' | 'size'>) => {
    const h = decorHeight(d.kind) / TILT
    return [d.x - d.size, d.y - h, d.x + d.size, d.y + 4] as BBox
  }
  const hit = (a: BBox, b: BBox) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

  const fits = (candidate: DecorShape) => {
    const box = footprint(candidate)
    const { x, y, size } = candidate
    const onLand =
      polygonContains(inner, [x - size * 0.9, y]) &&
      polygonContains(inner, [x + size * 0.9, y]) &&
      polygonContains(inner, [x, y])
    // 城鎮與地區名稱附近留空，房子和文字才看得清楚；標籤畫在最上層，
    // 所以只檢查圖示的底部（貼地的部分），山頂可以從名稱後方長出來
    const base: BBox = [box[0], y - (box[3] - box[1]) * 0.35, box[2], box[3]]
    const clearOfLabels = avoid.every(([ax, ay]) => !hit(base, [ax - 36, ay - 14, ax + 36, ay + 14]))
    // 大山、山丘彼此不重疊；樹可以前後交疊成樹林，只要樹幹不擠在一起
    const big = (d: DecorShape) => d.kind === 'mountain' || d.kind === 'hill'
    const clearOfOthers = placed.every((d) =>
      big(d) || big(candidate) ? !hit(box, footprint(d)) : Math.hypot(d.x - x, (d.y - y) * TILT) > (d.size + size) * 0.55,
    )
    return onLand && clearOfLabels && clearOfOthers
  }

  // 大山與山丘
  const bigCount = Math.min(4, Math.max(2, Math.round(area / 20000)))
  for (let i = 0, attempt = 0; i < bigCount && attempt < 200; attempt++) {
    // 每座島至少一座大山
    const kind = i === 0 || random() < 0.5 ? 'mountain' : 'hill'
    const candidate: DecorShape = {
      islandId,
      kind,
      x: center[0] + (random() - 0.5) * 1.4 * radius,
      y: center[1] + (random() - 0.5) * 1.4 * radius,
      size: decorSize(kind),
    }
    if (fits(candidate)) {
      placed.push(candidate)
      i++
    }
  }

  // 樹林：一群一群，往群聚中心集中
  const clusterCount = Math.max(6, Math.round(area / 3000))
  for (let c = 0; c < clusterCount; c++) {
    // 群聚中心要落在陸地上，試 20 次都落在海上就放在島中心
    let cx = center[0]
    let cy = center[1]
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = center[0] + (random() - 0.5) * 1.6 * radius
      const y = center[1] + (random() - 0.5) * 1.6 * radius
      if (polygonContains(inner, [x, y])) {
        cx = x
        cy = y
        break
      }
    }
    // 每群預定 4～8 棵，位置重疊就重抽，最多試八倍次數
    const count = 4 + Math.floor(random() * 5)
    for (let i = 0, attempt = 0; i < count && attempt < count * 8; attempt++) {
      const kind = random() < 0.45 ? 'pine' : 'tree'
      const candidate: DecorShape = {
        islandId,
        kind,
        x: cx + gaussian(random) * 18,
        y: cy + gaussian(random) * 18,
        size: decorSize(kind),
      }
      if (fits(candidate)) {
        placed.push(candidate)
        i++
      }
    }
  }

  // 投影成斜俯視座標，並由後往前排，前面的裝飾蓋住後面的
  return placed
    .map((d) => {
      const [x, y] = top([d.x, d.y])
      return { ...d, x: snap(x), y: snap(y) }
    })
    .sort((a, b) => a.y - b.y)
}

// 岩壁 = 海岸線每一段從表面往下掃的四邊形；from、to 是距離表面往下的高度（0 到 ELEVATION）
// 四邊形全部轉成同一方向，nonzero 填色時不會互相抵銷
function sweepPath(coast: Point[], from = 0, to = ELEVATION) {
  const at = (p: Point, depth: number): Point => {
    const [x, y] = top(p)
    return [x, y + depth]
  }
  return coast
    .map((p, i) => {
      const q = coast[(i + 1) % coast.length]
      const quad = [at(p, from), at(q, from), at(q, to), at(p, to)]
      return polygonPath(polygonArea(quad) < 0 ? quad.reverse() : quad)
    })
    .join('')
}

// 在所有島的外圍撒浪花，避開島本身
function scatterWaves(world: WorldLayout, random: () => number): Point[] {
  const boxes = world.islands.map((island) => world.bounds.get(island.id)!)
  if (!boxes.length) return []
  const [x0, y0, x1, y1] = union(boxes)
  const padX = (x1 - x0) * 0.25
  const padY = (y1 - y0) * 0.25
  const waves: Point[] = []
  for (let attempt = 0; attempt < 400 && waves.length < 40; attempt++) {
    const x = x0 - padX + random() * (x1 - x0 + padX * 2)
    const y = y0 - padY + random() * (y1 - y0 + padY * 2)
    const nearIsland = boxes.some(([bx0, by0, bx1, by1]) => x > bx0 - 30 && x < bx1 + 30 && y > by0 - 20 && y < by1 + 30)
    const nearWave = waves.some(([wx, wy]) => Math.abs(wx - x) < 40 && Math.abs(wy - y) < 20)
    if (!nearIsland && !nearWave) waves.push([x, y])
  }
  return waves
}

// portrait 為 true 時把島的排列轉成上下方向，配合直式螢幕
export function buildWorld(tree: MapNode, portrait = false): WorldLayout {
  const weight = (node: MapNode) => (node.children?.length ? 0 : 1)
  const subjects = hierarchy(tree).sum(weight).children ?? []

  // 決定每座島的位置：半徑依面積換算，加上海面寬度後互不重疊地排在一起
  const circles = subjects.map((subject) => ({
    subject,
    x: 0,
    y: 0,
    r: Math.sqrt(subject.value ?? 1) * ISLAND_UNIT + SEA_GAP,
  }))
  packSiblings(circles)
  if (portrait) {
    for (const circle of circles) [circle.x, circle.y] = [circle.y, circle.x]
  }

  const world: WorldLayout = { islands: [], regions: [], towns: [], decor: [], waves: [], bounds: new Map() }

  circles.forEach(({ subject, x, y, r }, islandIndex) => {
    const random = seededRandom(subject.data.id)
    const coast = coastline(x, y, r - SEA_GAP, random)
    const topCoast = coast.map(top)
    const baseCoast = coast.map(base)
    const islandBox = bboxOf([...topCoast, ...baseCoast])
    const center = polygonCentroid(coast) as Point

    world.islands.push({
      id: subject.data.id,
      data: subject.data,
      coast,
      path: smoothPath(topCoast) ?? polygonPath(topCoast),
      basePath: smoothPath(baseCoast) ?? polygonPath(baseCoast),
      cliffPath: sweepPath(coast),
      lipPath: sweepPath(coast, 0, ELEVATION * 0.3),
      bedrockPath: sweepPath(coast, ELEVATION * 0.68),
      palette: islandIndex,
    })
    world.bounds.set(subject.data.id, islandBox)

    // 城鎮與地區名稱的位置（平面座標），撒樹林時要避開
    const avoid: Point[] = []
    // 撒完裝飾後，島的範圍往上延伸到最高的山頂，島名與縮放範圍才不會切到山
    const decorate = () => {
      const decor = scatterDecor(subject.data.id, coast, center, avoid, random)
      world.decor.push(...decor)
      const peak = Math.min(...decor.map((d) => d.y - decorHeight(d.kind)))
      const box = world.bounds.get(subject.data.id)!
      if (peak < box[1]) world.bounds.set(subject.data.id, [box[0], peak, box[2], box[3]])
    }

    // 地區切割：Voronoi treemap 只接受逆時針的凸多邊形，先取凸包，畫的時候再用海岸線裁掉
    const island = hierarchy(subject.data).sum(weight) as PolygonNode
    if (!island.children) {
      decorate()
      return
    }
    let clip = polygonHull(coast) as Point[]
    if (polygonArea(clip) < 0) clip = clip.reverse()
    voronoiTreemap().clip(clip).prng(random).convergenceRatio(0.005).maxIterationCount(100)(island)

    island.children.forEach((category: PolygonNode, regionIndex) => {
      const polygon = category.polygon ?? clip
      const labelPoint = pullInside(polygonCentroid(polygon) as Point, coast, center)
      avoid.push(labelPoint)
      world.regions.push({
        id: category.data.id,
        islandId: subject.data.id,
        data: category.data,
        path: polygonPath(polygon.map(top)),
        polygon,
        label: top(labelPoint),
        color: regionIndex,
      })
      world.bounds.set(category.data.id, intersect(bboxOf(polygon.map(top)), islandBox))

      for (const concept of (category.children ?? []) as PolygonNode[]) {
        const cell = concept.polygon ?? polygon
        const townPoint = pullInside(polygonCentroid(cell) as Point, coast, center)
        avoid.push(townPoint)
        const [tx, ty] = top(townPoint)
        world.towns.push({
          id: concept.data.id,
          islandId: subject.data.id,
          regionId: category.data.id,
          data: concept.data,
          x: snap(tx),
          y: snap(ty),
        })
        world.bounds.set(concept.data.id, intersect(bboxOf(cell.map(top)), islandBox))
      }
    })
    decorate()
  })

  world.waves = scatterWaves(world, seededRandom(tree.id))
  world.islands.sort((a, b) => world.bounds.get(a.id)![3] - world.bounds.get(b.id)![3])
  world.bounds.set(tree.id, union(world.islands.map((island) => world.bounds.get(island.id)!)))
  return world
}
