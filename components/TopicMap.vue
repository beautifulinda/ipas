<script setup lang="ts">
import { hierarchy, pack, type HierarchyCircularNode } from 'd3-hierarchy'
import { select } from 'd3-selection'
import 'd3-transition'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import type { MapNode } from '~/utils/mapTree'

type PackedNode = HierarchyCircularNode<MapNode>

const props = defineProps<{ tree: MapNode }>()
const focusId = defineModel<string>('focusId', { required: true })

// SVG 內部座標固定為 SIZE × SIZE，實際大小由 viewBox 縮放
const SIZE = 1000
// 聚焦時圓外保留的邊距比例
const FIT_MARGIN = 1.1
const LABEL_SIZE = 24

const root = computed<PackedNode>(() =>
  pack<MapNode>()
    .size([SIZE, SIZE])
    .padding((node) => (node.depth === 0 ? 24 : 12))(
      hierarchy(props.tree).sum((node) => (node.children?.length ? 0 : 1)),
    ),
)

const nodes = computed(() => root.value.descendants().filter((node) => node.depth > 0))

const focusNode = computed(
  () => root.value.descendants().find((node) => node.data.id === focusId.value) ?? root.value,
)

// 只標示聚焦節點的下一層；聚焦在最底層時標示自己
const labelNodes = computed(() => focusNode.value.children ?? [focusNode.value])

const svgEl = ref<SVGSVGElement>()
const transform = ref(zoomIdentity)
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | undefined

function zoomTo(node: PackedNode, animate: boolean) {
  if (!svgEl.value || !zoomBehavior) return
  const k = SIZE / (node.r * 2 * FIT_MARGIN)
  const target = zoomIdentity.translate(SIZE / 2 - k * node.x, SIZE / 2 - k * node.y).scale(k)
  const svg = select(svgEl.value)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (animate && !reduceMotion) {
    svg.transition().duration(600).call(zoomBehavior.transform, target)
  } else {
    svg.call(zoomBehavior.transform, target)
  }
}

function activate(node: PackedNode) {
  focusId.value = node.data.id
}

function goUp() {
  const parent = focusNode.value.parent
  if (parent) activate(parent)
}

// 方向鍵在同層節點間切換，到頭尾時循環
function goSibling(step: number) {
  const siblings = focusNode.value.parent?.children
  if (!siblings || siblings.length < 2) return
  const index = siblings.indexOf(focusNode.value)
  activate(siblings[(index + step + siblings.length) % siblings.length])
}

// 鍵盤切換聚焦節點後，把 DOM 焦點一起移過去，焦點框才不會留在舊節點上
async function moveDomFocus() {
  await nextTick()
  svgEl.value
    ?.querySelector<SVGCircleElement>(`[data-id="${CSS.escape(focusNode.value.data.id)}"]`)
    ?.focus({ preventScroll: true })
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
  moveDomFocus()
}

function labelLines(title: string) {
  // 「科目一：人工智慧基礎概論」這類名稱在冒號後換行
  const index = title.indexOf('：')
  return index > 0 ? [title.slice(0, index + 1), title.slice(index + 1)] : [title]
}

// 有子層的節點把標籤放在圓的上緣，避免壓在子節點上；最底層節點置中
function labelY(node: PackedNode) {
  if (!node.children) return node.y
  const lineCount = labelLines(node.data.title).length
  return node.y - node.r + (LABEL_SIZE * (lineCount * 0.6 + 0.6)) / transform.value.k
}

watch(focusNode, (node) => zoomTo(node, true))

onMounted(() => {
  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.5, 40])
    .on('zoom', (event) => {
      transform.value = event.transform
    })
  select(svgEl.value!).call(zoomBehavior).on('dblclick.zoom', null)
  zoomTo(focusNode.value, false)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <svg
    ref="svgEl"
    class="topic-map"
    :viewBox="`0 0 ${SIZE} ${SIZE}`"
    role="group"
    aria-label="主題地圖"
    @click="goUp"
  >
    <g :transform="transform.toString()">
      <circle
        v-for="node in nodes"
        :key="node.data.id"
        :data-id="node.data.id"
        :cx="node.x"
        :cy="node.y"
        :r="node.r"
        :class="[
          'node',
          `node--${node.data.level}`,
          { 'node--focus': node === focusNode, 'node--passive': node.depth > focusNode.depth + 1 },
        ]"
        :stroke-width="2 / transform.k"
        :tabindex="labelNodes.includes(node) ? 0 : -1"
        :aria-hidden="node.depth > focusNode.depth + 1 ? 'true' : undefined"
        role="button"
        :aria-label="node.data.title"
        @click.stop="activate(node)"
        @keydown.enter.prevent="activate(node)"
        @keydown.space.prevent="activate(node)"
      >
        <title>{{ node.data.title }}</title>
      </circle>
      <text
        v-for="node in labelNodes"
        :key="`label-${node.data.id}`"
        class="label"
        :x="node.x"
        :y="labelY(node)"
        :font-size="LABEL_SIZE / transform.k"
        :stroke-width="6 / transform.k"
        text-anchor="middle"
        dominant-baseline="central"
      >
        <tspan
          v-for="(line, index) in labelLines(node.data.title)"
          :key="index"
          :x="node.x"
          :dy="index === 0 ? `${-(labelLines(node.data.title).length - 1) * 0.6}em` : '1.2em'"
        >
          {{ line }}
        </tspan>
      </text>
    </g>
  </svg>
</template>

<style scoped>
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

.node {
  stroke: #94a3b8;
  cursor: pointer;
  transition: fill 0.2s;
}

.node:focus {
  outline: none;
}

/* SVG 圓形用外框線表示鍵盤焦點，取代瀏覽器預設的方形焦點框 */
.node:hover,
.node:focus-visible {
  stroke: #1d4ed8;
}

.node:focus-visible {
  stroke-width: 4px;
  vector-effect: non-scaling-stroke;
}

.node--subject {
  fill: #e0e7ff;
}

.node--category {
  fill: #c7d2fe;
}

.node--concept {
  fill: #fff;
}

/* 比聚焦層的下一層更深的節點只顯示，點擊交給外層節點，避免一次跳過好幾層 */
.node--passive {
  pointer-events: none;
}

.node--focus {
  stroke: #1d4ed8;
}

.label {
  fill: #1e293b;
  stroke: #fff;
  stroke-linejoin: round;
  paint-order: stroke;
  pointer-events: none;
}
</style>
