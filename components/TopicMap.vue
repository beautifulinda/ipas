<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { hierarchy, treemap, type HierarchyNode } from 'd3-hierarchy'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import type { MapNode } from '~/utils/mapTree'
import { fitLines } from '~/utils/textFit'

// 畫面上的一個方塊；rel 是相對於聚焦節點的層數（1 為下一層）
interface Tile {
  id: string
  data: MapNode
  rel: number
  x0: number
  y0: number
  x1: number
  y1: number
  opacity: number
}

const props = defineProps<{ tree: MapNode }>()
const focusId = defineModel<string>('focusId', { required: true })

// 以下尺寸單位皆為 px（viewBox 與容器大小一致）
const HEADER = 32
const GAP = 4
const HEADER_FONT = 15
const TILE_FONT = 14
const LINE_HEIGHT = 1.35
const DURATION = 500

const wrapperEl = ref<HTMLDivElement>()
const svgEl = ref<SVGSVGElement>()
const { width, height } = useElementSize(wrapperEl)

// 完整的樹，用來找父節點與同層節點
const root = computed(() => hierarchy(props.tree))
const focusNode = computed(
  () => root.value.find((node) => node.data.id === focusId.value) ?? root.value,
)

// 只把聚焦節點的子樹排滿整個畫面，顯示往下兩層；面積依底下的概念數量分配
function layout(focus: HierarchyNode<MapNode>, w: number, h: number): Tile[] {
  const sub = treemap<MapNode>()
    .size([w, h])
    .paddingOuter(GAP)
    .paddingInner(GAP)
    .paddingTop((node) => (node.depth === 1 && node.children ? HEADER : GAP))
    .round(true)(hierarchy(focus.data).sum((node) => (node.children?.length ? 0 : 1)))

  // 聚焦在最底層時，畫出它自己
  const visible = sub.children
    ? sub.descendants().filter((node) => node.depth >= 1 && node.depth <= 2)
    : [sub]
  return visible.map((node) => ({
    id: node.data.id,
    data: node.data,
    rel: node.depth,
    x0: node.x0,
    y0: node.y0,
    x1: node.x1,
    y1: node.y1,
    opacity: 1,
  }))
}

const tiles = ref<Tile[]>([])
let frame = 0

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t
}

// 已在畫面上的方塊從原位置移動到新位置，新出現的方塊淡入
function render(animate: boolean) {
  if (!width.value || !height.value) return
  const target = layout(focusNode.value, width.value, height.value)
  const previous = new Map(tiles.value.map((tile) => [tile.id, tile]))
  cancelAnimationFrame(frame)

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!animate || reduceMotion) {
    tiles.value = target
    return
  }

  const start = performance.now()
  const step = (now: number) => {
    const t = easeInOut(Math.min(1, (now - start) / DURATION))
    tiles.value = target.map((tile) => {
      const from = previous.get(tile.id)
      if (!from) return { ...tile, opacity: t }
      return {
        ...tile,
        x0: lerp(from.x0, tile.x0, t),
        y0: lerp(from.y0, tile.y0, t),
        x1: lerp(from.x1, tile.x1, t),
        y1: lerp(from.y1, tile.y1, t),
        opacity: lerp(from.opacity, 1, t),
      }
    })
    if (t < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}

function hasHeader(tile: Tile) {
  return tile.rel === 1 && !!tile.data.children?.length
}

function isPassive(tile: Tile) {
  return tile.rel > 1
}

function headerLabel(tile: Tile) {
  return fitLines(tile.data.title, (tile.x1 - tile.x0 - 16) / HEADER_FONT, 1)[0]
}

// 方塊中央的多行標籤，回傳每一行的文字與 y 座標
function centerLabel(tile: Tile) {
  const lineHeight = TILE_FONT * LINE_HEIGHT
  const maxLines = Math.floor((tile.y1 - tile.y0 - 8) / lineHeight)
  const lines = fitLines(tile.data.title, (tile.x1 - tile.x0 - 12) / TILE_FONT, maxLines)
  const midY = (tile.y0 + tile.y1) / 2
  return lines.map((text, index) => ({
    text,
    y: midY + (index - (lines.length - 1) / 2) * lineHeight,
  }))
}

const transform = ref(zoomIdentity)
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | undefined

function resetZoom() {
  if (svgEl.value && zoomBehavior) select(svgEl.value).call(zoomBehavior.transform, zoomIdentity)
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
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return

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
  // 原本有焦點的方塊可能已離開畫面，把焦點交回地圖本身
  svgEl.value?.focus({ preventScroll: true })
}

watch(focusNode, () => {
  resetZoom()
  render(true)
})

watch([width, height], ([w, h]) => {
  zoomBehavior?.extent([[0, 0], [w, h]]).translateExtent([[0, 0], [w, h]])
  resetZoom()
  render(false)
})

onMounted(() => {
  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 8])
    .on('zoom', (event) => {
      transform.value = event.transform
    })
  select(svgEl.value!).call(zoomBehavior).on('dblclick.zoom', null)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="wrapperEl" class="map-wrapper">
    <svg
      ref="svgEl"
      class="topic-map"
      :viewBox="`0 0 ${width || 1} ${height || 1}`"
      role="group"
      aria-label="主題地圖"
      tabindex="-1"
      @click="goUp"
    >
      <g :transform="transform.toString()">
        <g
          v-for="tile in tiles"
          :key="tile.id"
          :opacity="tile.opacity"
          :class="['tile', `tile--${tile.data.level}`, { 'tile--passive': isPassive(tile) }]"
        >
          <rect
            :x="tile.x0"
            :y="tile.y0"
            :width="Math.max(0, tile.x1 - tile.x0)"
            :height="Math.max(0, tile.y1 - tile.y0)"
            rx="6"
            :tabindex="isPassive(tile) ? -1 : 0"
            :role="isPassive(tile) ? undefined : 'button'"
            :aria-hidden="isPassive(tile) ? 'true' : undefined"
            :aria-label="tile.data.title"
            @click.stop="activate(tile.id)"
            @keydown.enter.prevent="activate(tile.id)"
            @keydown.space.prevent="activate(tile.id)"
          >
            <title>{{ tile.data.title }}</title>
          </rect>
          <text
            v-if="hasHeader(tile)"
            class="label label--header"
            :x="tile.x0 + 8"
            :y="tile.y0 + HEADER / 2 + 1"
            :font-size="HEADER_FONT"
            dominant-baseline="central"
            aria-hidden="true"
          >
            {{ headerLabel(tile) }}
          </text>
          <text
            v-else
            class="label"
            :font-size="TILE_FONT"
            text-anchor="middle"
            dominant-baseline="central"
            aria-hidden="true"
          >
            <tspan
              v-for="(line, index) in centerLabel(tile)"
              :key="index"
              :x="(tile.x0 + tile.x1) / 2"
              :y="line.y"
            >
              {{ line.text }}
            </tspan>
          </text>
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

.topic-map {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  user-select: none;
}

.topic-map:active {
  cursor: grabbing;
}

.topic-map:focus {
  outline: none;
}

rect {
  stroke: #94a3b8;
  stroke-width: 1px;
  vector-effect: non-scaling-stroke;
  cursor: pointer;
}

rect:focus {
  outline: none;
}

/* 方塊用外框線表示滑鼠懸停與鍵盤焦點 */
rect:hover,
rect:focus-visible {
  stroke: #1d4ed8;
  stroke-width: 2px;
}

.tile--subject rect {
  fill: #e0e7ff;
}

.tile--category rect {
  fill: #c7d2fe;
}

.tile--concept rect {
  fill: #fff;
}

/* 比聚焦層的下一層更深的方塊只顯示，點擊交給外層方塊，避免一次跳過好幾層 */
.tile--passive {
  pointer-events: none;
}

.label {
  fill: #1e293b;
  pointer-events: none;
}

.label--header {
  font-weight: 600;
}
</style>
