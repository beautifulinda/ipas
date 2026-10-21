<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { hierarchy } from 'd3-hierarchy'
import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import { buildWorld, seededRandom, type BBox } from '~/utils/islandLayout'
import type { MapNode } from '~/utils/mapTree'
import type { Milestone, Progression } from '~/utils/progression'
import { makeFireworks, makeMarker } from '~/utils/scene/models'
import { SEA_COLOR, SKY_COLOR } from '~/utils/scene/palette'
import { buildWorld3D, type World3D } from '~/utils/scene/world3d'

// insetBottom：畫面底部被其他元素（手機的 bottom sheet）擋住的高度，聚焦時改對準上方可見範圍
// startId：建議從這裡開始的城鎮，標籤上方顯示「從這裡開始」
const props = withDefaults(
  defineProps<{ tree: MapNode; progression: Progression; startId?: string; insetBottom?: number }>(),
  { startId: undefined, insetBottom: 0 },
)
const focusId = defineModel<string>('focusId', { required: true })
// start：點了「從這裡開始」，要直接開始練習那個主題
const emit = defineEmits<{ unsupported: []; start: [conceptId: string] }>()

// 鏡頭：固定的斜俯視角度，旋轉鎖住
const FOV = 32
const ELEVATION = (54 * Math.PI) / 180
const FIT_MARGIN = 1.25

const wrapperEl = ref<HTMLDivElement>()
const canvasEl = ref<HTMLCanvasElement>()
const labelsEl = ref<HTMLDivElement>()
const { width, height } = useElementSize(wrapperEl)
const portrait = computed(() => height.value > width.value)

// 完整的樹，用來找父節點與同層節點
const root = computed(() => hierarchy(props.tree))
const focusNode = computed(() => root.value.find((node) => node.data.id === focusId.value) ?? root.value)
const focusPath = computed(() => focusNode.value.ancestors().reverse())
const focusIslandId = computed(() => focusPath.value[1]?.data.id)

const layout = computed(() => buildWorld(props.tree, portrait.value))

// 文字標籤：「從這裡開始」最優先、不受鏡頭所在的島限制；島名、地區名一律列出，城鎮名只列目前這座島的；
// 實際顯示與否由每格畫面的避讓排版決定
type LabelKind = 'start' | 'island' | 'region' | 'town'
interface Label {
  key: string
  anchor: string
  kind: LabelKind
  text: string
  // 城鎮的答對比例（0～1），畫成進度圓餅
  progress?: { ratio: number; text: string }
}
const labels = computed<Label[]>(() => [
  ...(props.startId ? [{ key: `start:${props.startId}`, anchor: props.startId, kind: 'start' as const, text: '從這裡開始' }] : []),
  ...layout.value.islands.map((i) => ({ key: i.id, anchor: i.id, kind: 'island' as const, text: i.data.title })),
  ...layout.value.regions.map((r) => ({ key: r.id, anchor: r.id, kind: 'region' as const, text: r.data.title })),
  ...layout.value.towns
    .filter((t) => t.islandId === focusIslandId.value)
    .map((t) => {
      const progress = props.progression.townProgress.get(t.id)
      return {
        key: t.id,
        anchor: t.id,
        kind: 'town' as const,
        text: t.data.title,
        progress: progress && { ratio: progress.correct / progress.total, text: `答對 ${progress.correct}／${progress.total}` },
      }
    }),
])

// 螢幕閱讀器與鍵盤用：目前這一層可以前往的位置
const navTargets = computed(() => focusNode.value.children?.map((c) => c.data) ?? [])
const startTitle = computed(() => layout.value.towns.find((t) => t.id === props.startId)?.data.title)

let renderer: THREE.WebGLRenderer | undefined
let camera: THREE.PerspectiveCamera
let controls: MapControls
let scene: THREE.Scene
let sun: THREE.DirectionalLight
let ocean: THREE.Mesh
let world: World3D | undefined
let marker: THREE.Mesh
let frame = 0
let lastTime = 0
const effects: { points: THREE.Points; update: (dt: number) => boolean }[] = []
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 鏡頭飛行動畫
let flight: { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; t: number } | undefined

function viewFor(box: BBox) {
  const w = Math.max(box[2] - box[0], 40)
  const d = Math.max(box[3] - box[1], 40)
  const aspect = width.value / Math.max(height.value, 1)
  const visibleRatio = Math.max(height.value - props.insetBottom, height.value * 0.3) / Math.max(height.value, 1)
  const tanV = Math.tan((FOV * Math.PI) / 360) * visibleRatio
  const tanH = Math.tan((FOV * Math.PI) / 360) * aspect
  // 斜看時，地面的深度會被壓縮成 sin(仰角)；再加上山與標籤的高度
  const distance = Math.max((w * FIT_MARGIN) / (2 * tanH), ((d * Math.sin(ELEVATION) + 70 * Math.cos(ELEVATION)) * FIT_MARGIN) / (2 * tanV))
  const target = new THREE.Vector3((box[0] + box[2]) / 2, 10, (box[1] + box[3]) / 2)
  const position = target.clone().add(new THREE.Vector3(0, Math.sin(ELEVATION), Math.cos(ELEVATION)).multiplyScalar(distance))
  return [position, target] as [THREE.Vector3, THREE.Vector3]
}

function flyToFocus(animate: boolean) {
  if (!renderer || !world) return
  const box = world.bounds.get(focusNode.value.data.id) ?? world.bounds.get('root')!
  const to = viewFor(box)
  if (!animate || reduceMotion()) {
    camera.position.copy(to[0])
    controls.target.copy(to[1])
    flight = undefined
    return
  }
  flight = { from: [camera.position.clone(), controls.target.clone()], to, t: 0 }
}

function applyViewport() {
  if (!renderer || !width.value || !height.value) return
  renderer.setSize(width.value, height.value, false)
  camera.aspect = width.value / height.value
  // bottom sheet 擋住下半部時，把畫面中心往上移
  if (props.insetBottom) camera.setViewOffset(width.value, height.value, 0, props.insetBottom / 2, width.value, height.value)
  else camera.clearViewOffset()
  camera.updateProjectionMatrix()
}

function rebuildWorld() {
  if (!renderer) return
  if (world) scene.remove(world.root)
  world = buildWorld3D(layout.value)
  scene.add(world.root)
  world.applyProgression(props.progression, false)
  const box = world.bounds.get('root')!
  const size = Math.max(box[2] - box[0], box[3] - box[1])
  const shadow = sun.shadow.camera
  shadow.left = shadow.bottom = -size
  shadow.right = shadow.top = size
  shadow.updateProjectionMatrix()
  sun.target.position.set((box[0] + box[2]) / 2, 0, (box[1] + box[3]) / 2)
  sun.position.copy(sun.target.position).add(new THREE.Vector3(-180, 320, 140))
}

// 點到某個物件時要前往哪個節點：最多只往下一層；點到其他分支時，前往分岔處的那一層
function resolveTarget(hitId: string) {
  const hitNode = root.value.find((n) => n.data.id === hitId)
  if (!hitNode) return
  const hitPath = hitNode.ancestors().reverse()
  const focus = focusPath.value
  let diverge = hitPath.findIndex((node, i) => focus[i] !== node)
  if (diverge < 0) diverge = hitPath.length - 1
  return hitPath[Math.min(diverge, focus.length)].data.id
}

const raycaster = new THREE.Raycaster()
function pick(event: PointerEvent) {
  if (!world || !canvasEl.value) return
  const rect = canvasEl.value.getBoundingClientRect()
  const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(world.pickables, true)[0]
  let object: THREE.Object3D | null = hit?.object ?? null
  while (object && !object.userData.nodeId) object = object.parent
  return object?.userData.nodeId as string | undefined
}

// 拖曳平移時不要觸發點擊：按下與放開的位置差不多才算點擊
let downAt: { x: number; y: number } | undefined
function onPointerDown(event: PointerEvent) {
  downAt = { x: event.clientX, y: event.clientY }
}
function onPointerUp(event: PointerEvent) {
  if (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 6) return
  downAt = undefined
  const hitId = pick(event)
  if (!hitId) return goUp()
  const target = resolveTarget(hitId)
  if (target) focusId.value = target
}
function onPointerMove(event: PointerEvent) {
  if (event.buttons || !canvasEl.value) return
  canvasEl.value.style.cursor = pick(event) ? 'pointer' : 'grab'
}

function goUp() {
  const parent = focusNode.value.parent
  if (parent) focusId.value = parent.data.id
}

// 方向鍵在同層節點間切換，到頭尾時循環
function goSibling(step: number) {
  const siblings = focusNode.value.parent?.children
  if (!siblings || siblings.length < 2) return
  const index = siblings.indexOf(focusNode.value)
  focusId.value = siblings[(index + step + siblings.length) % siblings.length].data.id
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target
  // 在輸入框或面板（data-no-map-keys）裡按鍵時，不切換地圖；在面板裡按 Esc 一樣回到上一層
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], [data-no-map-keys]')) {
    if (event.key !== 'Escape' || !target.closest('[data-no-map-keys]')) return
  }
  if (event.key === 'Escape') goUp()
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    goSibling(-1)
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    goSibling(1)
  }
}

type Box = [number, number, number, number]
const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

// 每格畫面重新排標籤：依島名 → 地區名 → 城鎮名的順序放，和已放好的標籤或房子重疊就換位置，全都重疊才隱藏
function placeLabels() {
  if (!world || !labelsEl.value) return
  const w = width.value
  const h = height.value
  const toScreen = (v: THREE.Vector3) => {
    const p = v.clone().project(camera)
    return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h, behind: p.z > 1 }
  }
  const placed: Box[] = []
  // 目前這座島的建築先佔位，標籤不會蓋住房子
  for (const label of labels.value) {
    if (label.kind !== 'town') continue
    const s = toScreen(world.townPosition(label.anchor))
    placed.push([s.x - 16, s.y - 36, s.x + 16, s.y + 4])
  }
  const elements = labelsEl.value.querySelectorAll<HTMLElement>('[data-key]')
  for (const el of elements) {
    const key = el.dataset.anchor!
    const kind = el.dataset.kind as LabelKind
    const anchor = kind === 'start' ? world.townPosition(key) : world.anchors.get(key)
    const bw = el.offsetWidth
    const bh = el.offsetHeight
    let visible = false
    if (anchor) {
      const s = toScreen(anchor)
      let candidates: [number, number][] = []
      // 「從這裡開始」放在城鎮正上方；島名的錨點在島的最後緣，標籤整個放在錨點上方
      if (kind === 'start') candidates = [[s.x, s.y - 44 - bh / 2]]
      else if (kind === 'island') candidates = [[s.x, s.y - bh / 2 - 6]]
      else if (kind === 'region') {
        // 地區在畫面上太小時不顯示名稱；換位置時不能離開地區範圍，免得看不出是哪個地區
        const box = world.bounds.get(key)!
        const left = toScreen(new THREE.Vector3(box[0], anchor.y, anchor.z))
        const right = toScreen(new THREE.Vector3(box[2], anchor.y, anchor.z))
        const back = toScreen(new THREE.Vector3(anchor.x, anchor.y, box[1]))
        const front = toScreen(new THREE.Vector3(anchor.x, anchor.y, box[3]))
        if (Math.abs(right.x - left.x) >= 70) {
          candidates = [0, -1, 1, -2, 2]
            .map((n): [number, number] => [s.x, s.y + n * (bh + 6)])
            .filter(([, y]) => y >= back.y && y <= front.y)
        }
      } else {
        candidates = [
          [s.x + 20 + bw / 2, s.y],
          [s.x - 20 - bw / 2, s.y],
          [s.x, s.y - 30 - bh / 2],
          [s.x, s.y + 22 + bh / 2],
        ]
      }
      if (!s.behind) {
        for (const [cx, cy] of candidates) {
          const box: Box = [cx - bw / 2 - 3, cy - bh / 2 - 3, cx + bw / 2 + 3, cy + bh / 2 + 3]
          const offscreen = box[2] < 0 || box[0] > w || box[3] < 0 || box[1] > h
          if (offscreen || (kind !== 'island' && kind !== 'start' && placed.some((p) => overlaps(box, p)))) continue
          placed.push(box)
          el.style.transform = `translate(${cx - bw / 2}px, ${cy - bh / 2}px)`
          visible = true
          break
        }
      }
    }
    el.style.visibility = visible ? 'visible' : 'hidden'
  }
}

function updateMarker(time: number) {
  if (!world) return
  const node = focusNode.value
  marker.visible = !node.children && node.depth === 3
  if (marker.visible) {
    const position = world.townPosition(node.data.id)
    marker.position.set(position.x, position.y + 30 + (reduceMotion() ? 0 : Math.sin(time * 4) * 2), position.z)
    marker.rotation.y = time
  }
}

function animateOcean(time: number) {
  if (reduceMotion()) return
  const position = ocean.geometry.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    position.setZ(i, Math.sin(x * 0.02 + time * 0.8) * 1.4 + Math.cos(y * 0.025 + time * 0.6) * 1.2)
  }
  position.needsUpdate = true
}

function loop(now: number) {
  frame = requestAnimationFrame(loop)
  if (!renderer || !world) return
  const time = now / 1000
  const dt = Math.min(0.05, lastTime ? time - lastTime : 0)
  lastTime = time

  if (flight) {
    flight.t = Math.min(1, flight.t + dt / 0.8)
    const t = flight.t < 0.5 ? 4 * flight.t ** 3 : 1 - (-2 * flight.t + 2) ** 3 / 2
    camera.position.lerpVectors(flight.from[0], flight.to[0], t)
    controls.target.lerpVectors(flight.from[1], flight.to[1], t)
    if (flight.t >= 1) flight = undefined
  }
  controls.enabled = !flight
  controls.update()

  animateOcean(time)
  world.animate(time, dt)
  updateMarker(time)
  for (let i = effects.length - 1; i >= 0; i--) {
    if (!effects[i].update(dt)) {
      scene.remove(effects[i].points)
      effects.splice(i, 1)
    }
  }
  renderer.render(scene, camera)
  placeLabels()
}

// 達成里程碑：在城鎮、旗子或燈塔的位置放煙火
function celebrate(milestones: Milestone[]) {
  if (!world || reduceMotion()) return
  const random = seededRandom(String(Date.now()))
  for (const milestone of milestones) {
    const origin =
      milestone.kind === 'tent' || milestone.kind === 'house' || milestone.kind === 'castle'
        ? world.townPosition(milestone.id).add(new THREE.Vector3(0, 30, 0))
        : milestone.kind === 'flag'
          ? world.regionFlagPosition(milestone.id)
          : world.lighthousePosition(milestone.id)
    const effect = makeFireworks(origin, random)
    scene.add(effect.points)
    effects.push(effect)
  }
}
defineExpose({ celebrate })

onMounted(() => {
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvasEl.value!, antialias: true })
  } catch {
    // 不支援 WebGL：改用清單模式
    emit('unsupported')
    return
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap

  scene = new THREE.Scene()
  scene.background = new THREE.Color(SKY_COLOR)
  scene.fog = new THREE.Fog(SKY_COLOR, 1800, 4200)

  camera = new THREE.PerspectiveCamera(FOV, 1, 1, 8000)
  scene.add(new THREE.HemisphereLight('#ffffff', '#6fa8c0', 1.6))
  sun = new THREE.DirectionalLight('#fff4e0', 2.2)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 1200
  sun.shadow.bias = -0.0005
  scene.add(sun, sun.target)

  // 海面：低多邊形，頂點隨時間起伏
  const oceanGeometry = new THREE.PlaneGeometry(5000, 5000, 90, 90)
  ocean = new THREE.Mesh(oceanGeometry, new THREE.MeshLambertMaterial({ color: SEA_COLOR, flatShading: true }))
  ocean.rotation.x = -Math.PI / 2
  ocean.receiveShadow = true
  scene.add(ocean)

  marker = makeMarker()
  scene.add(marker)

  controls = new MapControls(camera, renderer.domElement)
  controls.enableRotate = false
  controls.enableDamping = true
  controls.dampingFactor = 0.12
  controls.screenSpacePanning = false
  controls.zoomToCursor = true
  controls.minDistance = 60
  controls.maxDistance = 3500

  rebuildWorld()
  applyViewport()
  flyToFocus(false)
  window.addEventListener('keydown', onKeydown)
  frame = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  window.removeEventListener('keydown', onKeydown)
  controls?.dispose()
  renderer?.dispose()
})

watch(focusNode, () => flyToFocus(true))
watch([width, height], () => {
  applyViewport()
  flyToFocus(false)
})
watch(
  () => props.insetBottom,
  () => {
    applyViewport()
    flyToFocus(true)
  },
)
watch(layout, () => {
  rebuildWorld()
  flyToFocus(false)
})
watch(
  () => props.progression,
  (progression) => world?.applyProgression(progression, true),
)
</script>

<template>
  <div ref="wrapperEl" class="map3d">
    <canvas
      ref="canvasEl"
      class="canvas"
      role="img"
      aria-label="主題地圖（3D 島嶼）。可用下方的導覽按鈕、方向鍵與 Esc 操作，或切換到清單模式。"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointermove="onPointerMove"
    />
    <!-- 文字標籤疊在 3D 畫面上，位置每格畫面更新 -->
    <div ref="labelsEl" class="labels" aria-hidden="true">
      <div
        v-for="label in labels"
        :key="label.key"
        class="tag"
        :class="`tag--${label.kind}`"
        :data-key="label.key"
        :data-anchor="label.anchor"
        :data-kind="label.kind"
        @click="label.kind === 'start' && emit('start', label.anchor)"
      >
        <span
          v-if="label.progress"
          class="pie"
          :style="{ '--ratio': label.progress.ratio }"
          :title="label.progress.text"
        />
        {{ label.text }}
      </div>
    </div>
    <!-- 鍵盤與螢幕閱讀器的導覽：目前這一層可以前往的位置 -->
    <nav class="sr-nav" aria-label="地圖導覽">
      <button v-if="startId" type="button" @click="emit('start', startId)">從這裡開始：{{ startTitle }}</button>
      <button v-if="focusNode.parent" type="button" @click="goUp">回上一層</button>
      <button v-for="node in navTargets" :key="node.id" type="button" @click="focusId = node.id">
        前往：{{ node.title }}
      </button>
    </nav>
  </div>
</template>

<style scoped>
.map3d {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
}

.labels {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.tag {
  position: absolute;
  top: 0;
  left: 0;
  padding: 0.15rem 0.7rem;
  border: 2px solid #2b2633;
  border-radius: 999px;
  background: #fffdf4;
  box-shadow: 0 3px 0 rgba(43, 38, 51, 0.3);
  color: #2b2633;
  font-family: 'Arial Rounded MT Bold', 'PingFang TC', 'Noto Sans TC', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
  visibility: hidden;
  will-change: transform;
}

.tag--island {
  padding: 0.3rem 1rem;
  border-width: 2.5px;
  background: #ffe9a8;
  font-size: 18px;
}

.tag--region {
  font-size: 15px;
}

.tag--town {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  font-size: 13px;
}

/* 答對比例的圓餅：綠色是答對的部分 */
.pie {
  flex: none;
  width: 14px;
  height: 14px;
  border: 1.5px solid #2b2633;
  border-radius: 50%;
  background: conic-gradient(#3a9a4a calc(var(--ratio) * 360deg), #e8e2d4 0);
}

.tag--start {
  z-index: 1;
  /* 標籤層不接收點擊，只有這個標記可以點 */
  pointer-events: auto;
  cursor: pointer;
  padding: 0.25rem 0.8rem;
  border-color: #b23b37;
  background: #ff6b5e;
  color: #fff;
  font-size: 14px;
  animation: bob 1.6s ease-in-out infinite;
}

.tag--start::after {
  position: absolute;
  bottom: -9px;
  left: 50%;
  border: 7px solid transparent;
  border-top-color: #b23b37;
  border-bottom: 0;
  content: '';
  transform: translateX(-50%);
}

@keyframes bob {
  50% {
    margin-top: -4px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tag--start {
    animation: none;
  }
}

/* 平常隱藏，用 Tab 鍵移到時才出現在左下角 */
.sr-nav {
  position: absolute;
  bottom: 0.75rem;
  left: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  max-width: calc(100% - 1.5rem);
}

.sr-nav button {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.sr-nav:focus-within button {
  position: static;
  width: auto;
  height: auto;
  min-height: 44px;
  padding: 0 0.9rem;
  overflow: visible;
  clip-path: none;
  border: 2px solid #2b2633;
  border-radius: 10px;
  background: #fff7dc;
  font: inherit;
  font-weight: 700;
}
</style>
