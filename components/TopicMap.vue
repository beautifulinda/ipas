<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { hierarchy } from 'd3-hierarchy'
import { select } from 'd3-selection'
import 'd3-transition'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { ELEVATION, TILT, buildWorld, type DecorShape, type IslandShape } from '~/utils/islandLayout'
import type { MapNode } from '~/utils/mapTree'
import { OUTLINE, PIXEL_THEMES, PX, SPRITE_SIZE, rasterizeWorld, snap, sprite, type PixelTheme } from '~/utils/pixelArt'
import { fitLines } from '~/utils/textFit'

// insetBottom：畫面底部被其他元素（手機的 bottom sheet）擋住的高度，聚焦時改對準上方可見範圍
const props = withDefaults(defineProps<{ tree: MapNode; insetBottom?: number }>(), { insetBottom: 0 })
const focusId = defineModel<string>('focusId', { required: true })

// 字級單位為螢幕 px，畫的時候除以縮放倍率，放大縮小時字都維持同樣大小
const ISLAND_FONT = 20
const REGION_FONT = 16
const TOWN_FONT = 14
const FIT_MARGIN = 1.2
// 房子圖示的半寬與高度（地圖座標）
const HOUSE_HALF = (SPRITE_SIZE.house.w * PX) / 2
const HOUSE_HEIGHT = SPRITE_SIZE.house.h * PX

const clipPrefix = useId()

// 完整的樹，用來找父節點與同層節點
const root = computed(() => hierarchy(props.tree))
const focusNode = computed(
  () => root.value.find((node) => node.data.id === focusId.value) ?? root.value,
)
const focusPath = computed(() => focusNode.value.ancestors().reverse())
const focusIslandId = computed(() => focusPath.value[1]?.data.id)
const focusRegionId = computed(() => focusPath.value[2]?.data.id)

// 比聚焦層的下一層更深的元素只顯示，點擊交給外層，避免一次跳過好幾層
// 層數：島 1、地區 2、城鎮 3
const isPassive = (depth: number) => depth > focusNode.value.depth + 1
// 其他島上的地區也交給島本身處理：點其他島是先進那座島
const isRegionPassive = (islandId: string) => isPassive(2) || islandId !== focusIslandId.value

const wrapperEl = ref<HTMLDivElement>()
const svgEl = ref<SVGSVGElement>()
const { width, height } = useElementSize(wrapperEl)
const portrait = computed(() => height.value > width.value)
const world = computed(() => buildWorld(props.tree, portrait.value))
// 地形像素只跟版面有關，縮放時不用重算
const terrain = computed(() => rasterizeWorld(world.value, { tilt: TILT, elevation: ELEVATION }))

const transform = ref(zoomIdentity)
const k = computed(() => transform.value.k)
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | undefined

function themeOf(islandId: string): PixelTheme {
  const island = world.value.islands.find((i) => i.id === islandId)!
  return PIXEL_THEMES[island.palette % PIXEL_THEMES.length]
}

// 裝飾圖案的配色依所在島的主題而定
function decorSprite(item: DecorShape) {
  const theme = themeOf(item.islandId)
  const palettes: Record<DecorShape['kind'], Record<string, string>> = {
    mountain: { W: '#ffffff', S: '#cfd8e6', L: theme.mountain[0], D: theme.mountain[1] },
    hill: { H: theme.hill[0], B: theme.hill[1], D: theme.hill[2] },
    tree: { G: theme.crown[0], L: theme.crown[1], D: theme.crown[2], T: '#7a4a2a' },
    pine: { P: theme.pine[0], D: theme.pine[1], T: '#7a4a2a' },
  }
  return sprite(item.kind, palettes[item.kind])
}

const houseSprite = (current: boolean) =>
  sprite('house', { R: current ? '#4f8cff' : '#e04848', W: '#f5ead2', B: '#8fd3f0', D: '#7a4a2a' })
const markerSprite = sprite('marker', { Y: '#ffd23f' })
const waveSprite = sprite('wave', { w: '#a9dcf7' })

// 估算文字寬度（px）：中文約 1em、英數約 0.6em
function textWidth(text: string, fontSize: number) {
  return [...text].reduce((sum, ch) => sum + (/[\u0000-ÿ]/.test(ch) ? 0.6 : 1), 0) * fontSize
}

// 圓角標籤：依文字行數與寬度算出底板大小，單位換算成地圖座標
function pill(lines: string[], fontSize: number, cx: number, cy: number, padX = 12, padY = 5) {
  const scale = k.value
  const lineHeight = fontSize * 1.3
  const w = (Math.max(...lines.map((line) => textWidth(line, fontSize))) + padX * 2) / scale
  const h = (lines.length * lineHeight + padY * 2) / scale
  return {
    x: cx - w / 2,
    y: cy - h / 2,
    width: w,
    height: h,
    rx: Math.min(h / 2, 12 / scale),
    lines: lines.map((text, index) => ({
      text,
      y: cy + ((index - (lines.length - 1) / 2) * lineHeight) / scale,
    })),
  }
}

// 島名放在島上方；比島寬時在冒號後換行
function islandLabel(island: IslandShape) {
  const box = world.value.bounds.get(island.id)!
  const title = island.data.title
  const colon = title.indexOf('：')
  const tooWide = textWidth(title, ISLAND_FONT) > (box[2] - box[0]) * k.value * 1.2
  const lines = tooWide && colon > 0 ? [title.slice(0, colon + 1), title.slice(colon + 1)] : [title]
  const halfHeight = (lines.length * ISLAND_FONT * 1.3 + 14) / 2 / k.value
  return pill(lines, ISLAND_FONT, (box[0] + box[2]) / 2, box[1] - halfHeight - 10 / k.value, 16, 7)
}

type Box = [number, number, number, number]
const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

type TagKind = 'island' | 'region' | 'town'
type Tag = ReturnType<typeof pill> & { key: string; kind: TagKind; fontSize: number }

const visibleTowns = computed(() => world.value.towns.filter((t) => t.islandId === focusIslandId.value))

// 所有文字標籤統一排版，讓文字一定看得到：依島名 → 地區名 → 城鎮名的順序放，
// 每個標籤依序試幾個位置，和已放好的標籤或房子重疊就換下一個位置，全部都重疊才不顯示
const tags = computed<Tag[]>(() => {
  const scale = k.value
  const placed: Box[] = []
  const result: Tag[] = []
  const margin = 4 / scale

  const place = (key: string, kind: TagKind, fontSize: number, candidates: ReturnType<typeof pill>[], force = false) => {
    for (const tag of candidates) {
      const box: Box = [tag.x - margin, tag.y - margin, tag.x + tag.width + margin, tag.y + tag.height + margin]
      if (!force && placed.some((other) => overlaps(box, other))) continue
      placed.push(box)
      result.push({ ...tag, key, kind, fontSize })
      return
    }
  }

  // 房子先佔位，標籤不會蓋住房子
  for (const town of visibleTowns.value) {
    placed.push([town.x - HOUSE_HALF, town.y - HOUSE_HEIGHT, town.x + HOUSE_HALF, town.y])
  }

  for (const island of world.value.islands) {
    place(island.id, 'island', ISLAND_FONT, [islandLabel(island)], true)
  }

  for (const region of world.value.regions) {
    const box = world.value.bounds.get(region.id)!
    const screenWidth = (box[2] - box[0]) * scale
    if (screenWidth < 70) continue
    // 標籤在最上層，可以稍微超出地區範圍，避免短名稱被硬拆成兩行
    const lines = fitLines(region.data.title, (screenWidth * 1.4) / REGION_FONT, 2)
    const [x, y] = region.label
    const step = (REGION_FONT * 2.2) / scale
    place(
      region.id,
      'region',
      REGION_FONT,
      [0, -1, 1, -2, 2, -3, 3].map((n) => pill(lines, REGION_FONT, x, y + n * step, 10, 4)),
    )
  }

  for (const town of visibleTowns.value) {
    const lines = [town.data.title]
    const half = (textWidth(town.data.title, TOWN_FONT) + 16) / 2 / scale
    const gap = 10 / scale
    const midY = town.y - HOUSE_HEIGHT / 2
    // 依序試：房子右邊、左邊、上方、下方
    place(town.id, 'town', TOWN_FONT, [
      pill(lines, TOWN_FONT, town.x + HOUSE_HALF + gap + half, midY, 8, 3),
      pill(lines, TOWN_FONT, town.x - HOUSE_HALF - gap - half, midY, 8, 3),
      pill(lines, TOWN_FONT, town.x, town.y - HOUSE_HEIGHT - gap - 12 / scale, 8, 3),
      pill(lines, TOWN_FONT, town.x, town.y + gap + 12 / scale, 8, 3),
    ])
  }

  return result
})

// 把聚焦節點的範圍放大到填滿畫面
function zoomToFocus(animate: boolean) {
  if (!svgEl.value || !zoomBehavior || !width.value || !height.value) return
  const box = world.value.bounds.get(focusNode.value.data.id) ?? world.value.bounds.get(props.tree.id)!
  const bw = Math.max(box[2] - box[0], 1)
  const bh = Math.max(box[3] - box[1], 1)
  // 上方保留島名的高度（兩行），島名不會被切掉
  const labelSpace = ISLAND_FONT * 4
  const visibleHeight = Math.max(height.value - props.insetBottom, height.value * 0.3)
  const scale = Math.min(width.value / bw, (visibleHeight - labelSpace) / bh) / FIT_MARGIN
  const target = zoomIdentity
    .translate(
      width.value / 2 - scale * (box[0] + bw / 2),
      (visibleHeight + labelSpace) / 2 - scale * (box[1] + bh / 2),
    )
    .scale(scale)
  const svg = select(svgEl.value)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (animate && !reduceMotion) {
    svg.transition().duration(750).call(zoomBehavior.transform, target)
  } else {
    svg.call(zoomBehavior.transform, target)
  }
}

function activate(id: string) {
  focusId.value = id
}

function goUp() {
  const parent = focusNode.value.parent
  if (parent) activate(parent.data.id)
}

// 方向鍵在同層節點間切換，到頭尾時循環
function goSibling(step: number) {
  const siblings = focusNode.value.parent?.children
  if (!siblings || siblings.length < 2) return
  const index = siblings.indexOf(focusNode.value)
  activate(siblings[(index + step + siblings.length) % siblings.length].data.id)
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target
  // 在輸入框或面板（data-no-map-keys）裡按鍵時，不切換地圖
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], [data-no-map-keys]')) {
    // Esc 例外：在面板裡按 Esc 一樣回到上一層（關閉面板）
    if (event.key !== 'Escape' || !target.closest('[data-no-map-keys]')) return
  }

  if (event.key === 'Escape') {
    goUp()
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    goSibling(-1)
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    goSibling(1)
  } else {
    return
  }
  // 原本有焦點的元素可能已離開畫面，把焦點交回地圖本身
  svgEl.value?.focus({ preventScroll: true })
}

watch(focusNode, () => zoomToFocus(true))
watch([width, height], () => zoomToFocus(false))
watch(
  () => props.insetBottom,
  () => zoomToFocus(true),
)

onMounted(() => {
  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 80])
    .on('zoom', (event) => {
      transform.value = event.transform
    })
  select(svgEl.value!).call(zoomBehavior).on('dblclick.zoom', null)
  zoomToFocus(false)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="wrapperEl" class="map-wrapper">
    <svg
      ref="svgEl"
      class="world-map"
      :viewBox="`0 0 ${width || 1} ${height || 1}`"
      role="group"
      aria-label="主題地圖"
      tabindex="-1"
      @click="goUp"
    >
      <defs>
        <clipPath v-for="island in world.islands" :id="`${clipPrefix}-${island.id}`" :key="island.id">
          <path :d="island.path" />
        </clipPath>
      </defs>

      <g :transform="transform.toString()">
        <!-- 海面浪花 -->
        <g class="pixels">
          <g
            v-for="(wave, index) in world.waves"
            :key="`wave-${index}`"
            class="wave"
            :style="{ animationDelay: `${(index % 5) * -0.5}s` }"
            :transform="`translate(${snap(wave[0])}, ${snap(wave[1])}) scale(${PX})`"
          >
            <path v-for="run in waveSprite" :key="run.color" :fill="run.color" :d="run.d" />
          </g>
        </g>

        <!-- 地形：整張地圖的像素，依顏色合併成少數幾條 path -->
        <g class="pixels">
          <path v-for="run in terrain" :key="run.color" :fill="run.color" :d="run.d" />
        </g>

        <!-- 點擊範圍：透明的島與地區形狀疊在像素上面 -->
        <g v-for="island in world.islands" :key="`hit-${island.id}`">
          <path
            class="hit land"
            :class="{ passive: isPassive(1) }"
            :d="island.path"
            :tabindex="isPassive(1) ? -1 : 0"
            role="button"
            :aria-label="island.data.title"
            @click.stop="activate(island.id)"
            @keydown.enter.prevent="activate(island.id)"
            @keydown.space.prevent="activate(island.id)"
          >
            <title>{{ island.data.title }}</title>
          </path>
          <g :clip-path="`url(#${clipPrefix}-${island.id})`">
            <path
              v-for="region in world.regions.filter((r) => r.islandId === island.id)"
              :key="region.id"
              class="hit region"
              :class="{ passive: isRegionPassive(region.islandId), current: region.id === focusRegionId }"
              :d="region.path"
              :tabindex="isRegionPassive(region.islandId) ? -1 : 0"
              :role="isRegionPassive(region.islandId) ? undefined : 'button'"
              :aria-hidden="isRegionPassive(region.islandId) ? 'true' : undefined"
              :aria-label="region.data.title"
              @click.stop="activate(region.id)"
              @keydown.enter.prevent="activate(region.id)"
              @keydown.space.prevent="activate(region.id)"
            >
              <title>{{ region.data.title }}</title>
            </path>
          </g>
        </g>

        <!-- 山、山丘與樹（已依前後順序排好），不能點 -->
        <g class="pixels decor">
          <g
            v-for="(item, index) in world.decor"
            :key="`decor-${index}`"
            :transform="`translate(${item.x}, ${item.y}) scale(${PX})`"
          >
            <path v-for="run in decorSprite(item)" :key="run.color" :fill="run.color" :d="run.d" />
          </g>
        </g>

        <!-- 城鎮：聚焦到島之後才出現 -->
        <g
          v-for="town in visibleTowns"
          :key="town.id"
          class="town"
          :class="{ passive: isPassive(3), current: town.id === focusId }"
          :tabindex="isPassive(3) ? -1 : 0"
          :role="isPassive(3) ? undefined : 'button'"
          :aria-hidden="isPassive(3) ? 'true' : undefined"
          :aria-label="town.data.title"
          @click.stop="activate(town.id)"
          @keydown.enter.prevent="activate(town.id)"
          @keydown.space.prevent="activate(town.id)"
        >
          <title>{{ town.data.title }}</title>
          <!-- 點擊範圍比房子大一圈，且在螢幕上至少 44px，手指才點得到 -->
          <rect
            class="town-hit"
            :x="town.x - Math.max(HOUSE_HALF + PX, 22 / k)"
            :y="town.y - HOUSE_HEIGHT / 2 - Math.max(HOUSE_HEIGHT / 2 + PX, 22 / k)"
            :width="Math.max(HOUSE_HALF + PX, 22 / k) * 2"
            :height="Math.max(HOUSE_HEIGHT / 2 + PX, 22 / k) * 2"
          />
          <g class="pixels" :transform="`translate(${town.x}, ${town.y}) scale(${PX})`">
            <g class="house">
              <path v-for="run in houseSprite(town.id === focusId)" :key="run.color" :fill="run.color" :d="run.d" />
            </g>
            <!-- 目前選到的城鎮上方有一個上下跳動的箭頭 -->
            <!-- 外層負責定位、內層負責跳動：CSS 動畫的 transform 會蓋掉 SVG 的 transform 屬性 -->
            <g v-if="town.id === focusId" :transform="`translate(0, ${-SPRITE_SIZE.house.h})`">
              <g class="marker">
                <path v-for="run in markerSprite" :key="run.color" :fill="run.color" :d="run.d" />
              </g>
            </g>
          </g>
        </g>

        <!-- 文字標籤放在最上層，不會被地區、樹或山蓋住；地圖是像素風，標籤刻意用圓角平滑的樣式方便閱讀 -->
        <g class="labels" aria-hidden="true">
          <g v-for="tag in tags" :key="`tag-${tag.key}`" class="tag" :class="`tag--${tag.kind}`">
            <rect
              class="tag-shadow"
              :x="tag.x"
              :y="tag.y + 3 / k"
              :width="tag.width"
              :height="tag.height"
              :rx="tag.rx"
            />
            <rect class="tag-box" :x="tag.x" :y="tag.y" :width="tag.width" :height="tag.height" :rx="tag.rx" />
            <text :font-size="tag.fontSize / k" text-anchor="middle" dominant-baseline="central">
              <tspan v-for="(line, index) in tag.lines" :key="index" :x="tag.x + tag.width / 2" :y="line.y">
                {{ line.text }}
              </tspan>
            </text>
          </g>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.map-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.world-map {
  display: block;
  width: 100%;
  height: 100%;
  background: #3b8fd4;
  cursor: grab;
  user-select: none;
}

.world-map:active {
  cursor: grabbing;
}

.world-map:focus {
  outline: none;
}

/* 像素圖層關掉反鋸齒，方格邊緣才會銳利 */
.pixels {
  shape-rendering: crispEdges;
  pointer-events: none;
}

.wave {
  animation: blink 2.4s steps(2) infinite;
}

/* 點擊範圍本身透明，只在滑鼠移上去或選到時微微變亮 */
.hit {
  fill: transparent;
  cursor: pointer;
  outline: none;
}

.land:hover,
.land:focus-visible,
.region:hover,
.region:focus-visible {
  fill: rgba(255, 255, 255, 0.16);
}

.region.current {
  fill: rgba(255, 255, 255, 0.1);
  stroke: #ffd23f;
  stroke-width: 3px;
  stroke-dasharray: 6 6;
  vector-effect: non-scaling-stroke;
  shape-rendering: crispEdges;
}

.town {
  cursor: pointer;
  outline: none;
}

.town-hit {
  fill: transparent;
}

.town:hover .house,
.town:focus-visible .house {
  animation: hop 0.4s steps(2);
}

.marker {
  animation: bob 0.8s steps(2) infinite;
}

/* 圓角標籤 */
.tag {
  pointer-events: none;
  font-family: 'Arial Rounded MT Bold', 'PingFang TC', 'Noto Sans TC', system-ui, sans-serif;
}

.tag-shadow {
  fill: rgba(43, 38, 51, 0.35);
}

.tag-box {
  fill: #fff7dc;
  stroke: v-bind(OUTLINE);
  stroke-width: 2px;
  vector-effect: non-scaling-stroke;
}

.tag--island .tag-box {
  fill: #ffe9a8;
}

.tag--region .tag-box {
  fill: #fffdf4;
}

.tag text {
  fill: v-bind(OUTLINE);
  font-weight: 800;
}

.passive {
  pointer-events: none;
}

@keyframes blink {
  0%,
  100% {
    opacity: 0.9;
  }
  50% {
    opacity: 0.4;
  }
}

@keyframes bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-1px);
  }
}

@keyframes hop {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-1px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wave,
  .marker,
  .town:hover .house,
  .town:focus-visible .house {
    animation: none;
  }
}
</style>
