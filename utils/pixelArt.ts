import { polygonContains } from 'd3-polygon'
import type { Point, WorldLayout } from '~/utils/islandLayout'

// 像素格大小（地圖座標）；地形、圖示都對齊這個格子，像素大小才會一致
export const PX = 4

export const OUTLINE = '#2b2633'

// 每座島一組像素配色
export const PIXEL_THEMES = [
  {
    // 草原島
    land: ['#6cbf47', '#62b63f', '#77c852', '#5aac3a', '#71c34c'],
    detail: '#53a034',
    border: '#3f8a2a',
    beach: '#f0d48a',
    lip: '#4f9e33',
    soil: '#a8683a',
    bedrock: '#7a4a2a',
    hill: ['#c8f29a', '#8fd65f', '#4f9e33'],
    mountain: ['#9aa8c2', '#6a7590'],
    crown: ['#2f8a34', '#5bc04f', '#1f6a26'],
    pine: ['#2a7a3a', '#1c5a2a'],
  },
  {
    // 秋楓島
    land: ['#f2b84b', '#eaad40', '#f7c562', '#e0a035', '#f4be57'],
    detail: '#d99a32',
    border: '#b8741f',
    beach: '#fff1c2',
    lip: '#c98a2a',
    soil: '#b8693a',
    bedrock: '#80442a',
    hill: ['#ffe6a8', '#ffcf6e', '#d38a2a'],
    mountain: ['#d59a78', '#a0644a'],
    crown: ['#e0602f', '#ff9a4f', '#b0451f'],
    pine: ['#c9502a', '#94381c'],
  },
  {
    // 薰衣草島
    land: ['#b9a2fb', '#ae95f5', '#c6b3ff', '#a48bee', '#bfaaff'],
    detail: '#9c82ea',
    border: '#7c62d0',
    beach: '#ffeec2',
    lip: '#8d6fe0',
    soil: '#a8683a',
    bedrock: '#7a4a2a',
    hill: ['#e6dcff', '#c9b6ff', '#8d6fe0'],
    mountain: ['#b3a6d6', '#7f70b0'],
    crown: ['#7b5bd6', '#a58bf0', '#5a3eb0'],
    pine: ['#6a4bc4', '#4a3196'],
  },
]

export type PixelTheme = (typeof PIXEL_THEMES)[number]

// 像素圖案：每個字元一格，'.' 為透明；顏色由 palette 對照
const SPRITE_MAPS = {
  mountain: [
    '..........k..........',
    '.........kWk.........',
    '........kWWSk........',
    '.......kWWWSSk.......',
    '......kWWLWSDDk......',
    '.....kLLLLLLDDDk.....',
    '....kLLLLLLDDDDDk....',
    '....kLLLLLDDDDDDk....',
    '...kLLLLLLDDDDDDDk...',
    '...kLLLLLDDDDDDDDk...',
    '..kLLLLLLDDDDDDDDDk..',
    '..kLLLLLDDDDDDDDDDk..',
    '.kLLLLLLDDDDDDDDDDDk.',
    '.kLLLLLDDDDDDDDDDDDk.',
    'kLLLLLLDDDDDDDDDDDDDk',
    'kLLLLLDDDDDDDDDDDDDDk',
    'kkkkkkkkkkkkkkkkkkkkk',
  ],
  hill: [
    '....kkkkk....',
    '..kkHHBBBkk..',
    '.kHHBBBBBBBk.',
    '.kHBBBBBBBDk.',
    'kBBBBBBBBDDDk',
    'kBBBBBBBDDDDk',
    'kkkkkkkkkkkkk',
  ],
  tree: [
    '..kkk..',
    '.kGLLk.',
    'kGGGLLk',
    'kGGGGGk',
    'kDGGGGk',
    '.kDDDk.',
    '..kTk..',
    '..kTk..',
    '..kkk..',
  ],
  pine: [
    '...k...',
    '..kPk..',
    '..kPk..',
    '.kPPDk.',
    '.kPPDk.',
    'kPPPPDk',
    'kPPPDDk',
    '.kkTkk.',
    '..kTk..',
    '..kkk..',
  ],
  house: [
    '....k....',
    '...kRk...',
    '..kRRRk..',
    '.kRRRRRk.',
    'kkkkkkkkk',
    '.kWWWWWk.',
    '.kBWWDWk.',
    '.kWWWDWk.',
    '.kkkkkkk.',
  ],
  marker: ['kkkkk', 'kYYYk', '.kYk.', '..k..'],
  wave: ['.ww...', 'w..ww.'],
} as const

export type SpriteName = keyof typeof SPRITE_MAPS

// 圖案大小（像素格數）
export const SPRITE_SIZE = Object.fromEntries(
  Object.entries(SPRITE_MAPS).map(([name, rows]) => [name, { w: rows[0].length, h: rows.length }]),
) as Record<SpriteName, { w: number; h: number }>

export interface ColorRun {
  color: string
  d: string
}

// 同一列連續同色的格子合併成一段，再依顏色組成一條 path，元素數量少、縮放不卡
function runsToPaths(rows: (string | null)[][], cell: number, x0 = 0, y0 = 0): ColorRun[] {
  const byColor = new Map<string, string[]>()
  rows.forEach((row, j) => {
    let i = 0
    while (i < row.length) {
      const color = row[i]
      let end = i + 1
      while (end < row.length && row[end] === color) end++
      if (color) {
        const parts = byColor.get(color) ?? []
        parts.push(`M${x0 + i * cell},${y0 + j * cell}h${(end - i) * cell}v${cell}h${-(end - i) * cell}z`)
        byColor.set(color, parts)
      }
      i = end
    }
  })
  return [...byColor].map(([color, parts]) => ({ color, d: parts.join('') }))
}

// 圖案依配色轉成 path；以「底部中央」為原點，單位為像素格（畫的時候再乘上 PX）
const spriteCache = new Map<string, ColorRun[]>()
export function sprite(name: SpriteName, palette: Record<string, string>): ColorRun[] {
  const key = `${name}:${JSON.stringify(palette)}`
  const cached = spriteCache.get(key)
  if (cached) return cached
  const map = SPRITE_MAPS[name]
  const { w, h } = SPRITE_SIZE[name]
  const rows = map.map((row) => [...row].map((ch) => (ch === 'k' ? OUTLINE : (palette[ch] ?? null))))
  const result = runsToPaths(rows, 1, -Math.floor(w / 2), -h)
  spriteCache.set(key, result)
  return result
}

export function snap(value: number) {
  return Math.round(value / PX) * PX
}

// 斜俯視投影參數（與 islandLayout 一致）
interface Projection {
  tilt: number
  elevation: number
}

// 把整張地圖切成像素格，逐格判斷是海、岸邊輪廓、浪花、沙灘、地區草地或岩壁的哪一層
export function rasterizeWorld(world: WorldLayout, { tilt, elevation }: Projection): ColorRun[] {
  const boxes = world.islands.map((island) => world.bounds.get(island.id)!)
  if (!boxes.length) return []
  const pad = PX * 3
  const x0 = Math.floor((Math.min(...boxes.map((b) => b[0])) - pad) / PX) * PX
  const y0 = Math.floor((Math.min(...boxes.map((b) => b[1])) - pad) / PX) * PX
  const x1 = Math.max(...boxes.map((b) => b[2])) + pad
  const y1 = Math.max(...boxes.map((b) => b[3])) + pad
  const cols = Math.ceil((x1 - x0) / PX)
  const rows = Math.ceil((y1 - y0) / PX)

  // 斜俯視座標 → 平面座標（表面）
  const toFlat = (x: number, y: number): Point => [x, (y + elevation) / tilt]
  const BEACH = 9

  const grid: (string | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null))
  const solid: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false))

  // 島依前後順序處理，前面的島覆蓋後面的島
  world.islands.forEach((island, islandIndex) => {
    const theme = PIXEL_THEMES[island.palette % PIXEL_THEMES.length]
    const box = boxes[islandIndex]
    const regions = world.regions.filter((r) => r.islandId === island.id)
    const regionAt = (p: Point) => regions.findIndex((r) => polygonContains(r.polygon, p))
    const coast = island.coast

    for (let j = 0; j < rows; j++) {
      const cy = y0 + (j + 0.5) * PX
      if (cy < box[1] - PX || cy > box[3] + PX) continue
      for (let i = 0; i < cols; i++) {
        const cx = x0 + (i + 0.5) * PX
        if (cx < box[0] - PX || cx > box[2] + PX) continue

        const flat = toFlat(cx, cy)
        if (polygonContains(coast, flat)) {
          // 表面：靠近海岸是沙灘，其餘依所在地區上色
          const nearCoast = [
            [BEACH, 0],
            [-BEACH, 0],
            [0, BEACH],
            [0, -BEACH],
          ].some(([dx, dy]) => !polygonContains(coast, [flat[0] + dx, flat[1] + dy]))
          let color: string
          if (nearCoast) {
            color = theme.beach
          } else {
            const index = regionAt(flat)
            const right = regionAt(toFlat(cx + PX, cy))
            const down = regionAt(toFlat(cx, cy + PX))
            if (index >= 0 && ((right >= 0 && right !== index) || (down >= 0 && down !== index))) {
              color = theme.border
            } else if ((i * 3 + j * 5) % 13 === 0) {
              color = theme.detail
            } else {
              color = theme.land[(regions[index]?.color ?? 0) % theme.land.length]
            }
          }
          grid[j][i] = color
          solid[j][i] = true
          continue
        }

        // 岩壁：往上找到表面的距離，就是這格在岩壁上的深度
        for (let depth = PX / 2; depth <= elevation; depth += PX / 2) {
          if (polygonContains(coast, toFlat(cx, cy - depth))) {
            grid[j][i] = depth <= elevation * 0.3 ? theme.lip : depth > elevation * 0.68 ? theme.bedrock : theme.soil
            solid[j][i] = true
            break
          }
        }
      }
    }
  })

  // 島的外圍：先描一圈深色輪廓，再往外一圈白色浪花
  const neighbors = (i: number, j: number) =>
    [
      [i + 1, j],
      [i - 1, j],
      [i, j + 1],
      [i, j - 1],
    ].filter(([a, b]) => a >= 0 && b >= 0 && a < cols && b < rows)
  const outline: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false))
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (!solid[j][i] && neighbors(i, j).some(([a, b]) => solid[b][a])) {
        grid[j][i] = OUTLINE
        outline[j][i] = true
      }
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (!solid[j][i] && !outline[j][i] && neighbors(i, j).some(([a, b]) => outline[b][a])) {
        grid[j][i] = '#d6f4ff'
      }
    }
  }

  return runsToPaths(grid, PX, x0, y0)
}
