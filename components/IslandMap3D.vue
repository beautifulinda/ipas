<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { hierarchy } from 'd3-hierarchy'
import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import { buildWorld, seededRandom, type BBox } from '~/utils/islandLayout'
import type { MapNode } from '~/utils/mapTree'
import { nextStopText, progressText, type CelebrationPlan, type Progression } from '~/utils/progression'
import { makeFireworks, makeLightPillar, makeMarker, makeStarBurst, type Effect } from '~/utils/scene/models'
import { SEA_COLOR, SKY_COLOR } from '~/utils/scene/palette'
import { buildWorld3D, type World3D } from '~/utils/scene/world3d'

// insetBottom：畫面底部被其他元素（手機的 bottom sheet）擋住的高度，聚焦時改對準上方可見範圍
// startId：建議從這裡開始的城鎮，標籤上方顯示「從這裡開始」
// nextId：目前的主題全部作答過時，建議的下一站；目前這棟建築上方顯示「下一站」，取代「作答中」與「從這裡開始」
// answering：正在作答目前這個主題（鍵盤在右邊的題目上），questionNumber 是第幾題；地圖放大到建築物並顯示提示
const props = withDefaults(
  defineProps<{
    tree: MapNode
    progression: Progression
    startId?: string
    nextId?: string
    insetBottom?: number
    answering?: boolean
    questionNumber?: number
  }>(),
  { startId: undefined, nextId: undefined, insetBottom: 0, answering: false, questionNumber: 1 },
)
const focusId = defineModel<string>('focusId', { required: true })
// start：點了「從這裡開始」或「下一站」，要直接開始練習那個主題
// leave：作答中用滑鼠點了地圖，回到地圖模式
// 按鍵規則不在這裡，集中在 composables/useMapKeyboard.ts，透過 defineExpose 的操作控制地圖
const emit = defineEmits<{ unsupported: []; start: [conceptId: string]; leave: [] }>()

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
type LabelKind = 'start' | 'next' | 'answering' | 'island' | 'region' | 'town'
interface Label {
  key: string
  anchor: string
  kind: LabelKind
  text: string
  // 城鎮的答對、答錯比例（0～1），畫成進度圓餅；tally 只在目前選到的城鎮顯示
  progress?: { correct: number; wrong: number; text: string; tally?: string }
}
// 作答中只顯示「作答中」的提示，不顯示「從這裡開始」
const answeringHere = computed(() => props.answering && focusNode.value.depth === 3)
const nextHere = computed(() => Boolean(props.nextId) && focusNode.value.depth === 3)
const nextTitle = computed(() => layout.value.towns.find((t) => t.id === props.nextId)?.data.title ?? '')
const labels = computed<Label[]>(() => [
  ...(nextHere.value
    ? [{ key: `next:${props.nextId}`, anchor: focusId.value, kind: 'next' as const, text: nextStopText(nextTitle.value) }]
    : answeringHere.value
    ? [{ key: `answering:${focusId.value}`, anchor: focusId.value, kind: 'answering' as const, text: `作答中：第 ${props.questionNumber} 題・請看右邊的題目` }]
    : props.startId
      ? [{ key: `start:${props.startId}`, anchor: props.startId, kind: 'start' as const, text: '從這裡開始' }]
      : []),
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
        progress: progress && {
          correct: progress.correct / progress.total,
          wrong: progress.wrong / progress.total,
          text: progressText(progress),
          tally: focusNode.value.depth === 3 && t.id === focusId.value ? progressText(progress) : undefined,
        },
      }
    }),
])

// 螢幕閱讀器與鍵盤用：目前這一層可以前往的位置
const navTargets = computed(() => focusNode.value.children?.map((c) => c.data) ?? [])
const startTitle = computed(() => layout.value.towns.find((t) => t.id === props.startId)?.data.title)
// 按 Esc 回到地圖時焦點移到地圖上，報讀軟體會唸出目前的位置
const mapLabel = computed(
  () => `主題地圖（3D 島嶼），目前在「${focusNode.value.data.title}」。可用下方的導覽按鈕、方向鍵、Enter 與 Esc 操作，或切換到清單模式。`,
)
// 給 E2E 檢查鏡頭對準哪裡：town:主題ID 表示放大到建築物
const viewKey = computed(() => (answeringHere.value ? `town:${focusId.value}` : focusId.value))

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
const effects: Effect[] = []
// 煙火爆開時照亮附近的閃光；固定一盞燈只調亮度，中途增減燈光會讓 three.js 重新編譯材質，手機上會卡一下
let flashLight: THREE.PointLight
let flashAge = Infinity
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
  // 作答中放大到建築物：對準城鎮，距離拉近到一半左右
  if (answeringHere.value) {
    const town = world.townPosition(focusNode.value.data.id).setY(10)
    to[0] = town.clone().add(to[0].clone().sub(to[1]).multiplyScalar(0.5))
    to[1] = town
  }
  flyTo(to, animate)
}

function flyTo(to: [THREE.Vector3, THREE.Vector3], animate: boolean) {
  if (!animate || reduceMotion()) {
    camera.position.copy(to[0])
    controls.target.copy(to[1])
    flight = undefined
    return
  }
  flight = { from: [camera.position.clone(), controls.target.clone()], to, t: 0 }
}

// 右上角的鏡頭按鈕：只移動鏡頭，不換主題，右側面板與作答狀態都保留
function viewAll() {
  if (!renderer || !world) return
  showcase = undefined
  flyTo(viewFor(world.bounds.get('root')!), true)
}

function viewCurrent() {
  showcase = undefined
  flyToFocus(true)
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
  // 作答中點了地圖：回到地圖模式，再照一般的點擊處理
  if (props.answering) emit('leave')
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
    const above = kind === 'start' || kind === 'next' || kind === 'answering'
    const anchor = above ? world.townPosition(key) : world.anchors.get(key)
    const bw = el.offsetWidth
    const bh = el.offsetHeight
    let visible = false
    if (anchor) {
      const s = toScreen(anchor)
      let candidates: [number, number][] = []
      // 「從這裡開始」放在城鎮正上方；島名的錨點在島的最後緣，標籤整個放在錨點上方
      if (above) candidates = [[s.x, s.y - (kind === 'start' ? 44 : 64) - bh / 2]]
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
          if (offscreen || (kind !== 'island' && !above && placed.some((p) => overlaps(box, p)))) continue
          placed.push(box)
          el.style.transform = `translate(${cx - bw / 2}px, ${cy - bh / 2}px)`
          visible = true
          break
        }
      }
    }
    el.style.visibility = visible ? 'visible' : 'hidden'
    // 錨點在畫面上的位置，E2E 用來模擬滑鼠點城鎮
    if (kind === 'town') {
      const s = toScreen(world.townPosition(key))
      el.dataset.x = String(Math.round(s.x))
      el.dataset.y = String(Math.round(s.y))
    }
  }
}

function updateMarker(time: number) {
  if (!world) return
  const node = focusNode.value
  marker.visible = !node.children && node.depth === 3
  if (marker.visible) {
    const position = world.townPosition(node.data.id)
    const above = Math.max(30, world.townHeight(node.data.id) + 10)
    marker.position.set(position.x, position.y + above + (reduceMotion() ? 0 : Math.sin(time * 4) * 2), position.z)
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
  if (showcase) animateShowcase(dt)
  controls.enabled = !flight && !showcase
  controls.update()
  flashAge += dt
  flashLight.intensity = Math.max(0, 1 - flashAge / 0.35) * 9000

  animateOcean(time)
  world.animate(time, dt, !reduceMotion())
  updateMarker(time)
  for (let i = effects.length - 1; i >= 0; i--) {
    if (effects[i].update(dt)) continue
    scene.remove(effects[i].object)
    effects[i].dispose()
    effects.splice(i, 1)
  }
  renderer.render(scene, camera)
  placeLabels()
}

// 鏡頭特寫：靠近目標、繞半圈，再回到原本的位置
let showcase: { t: number; from: [THREE.Vector3, THREE.Vector3]; center: THREE.Vector3 } | undefined
const SHOWCASE_SECONDS = 3.2

function animateShowcase(dt: number) {
  const s = showcase!
  s.t = Math.min(1, s.t + dt / SHOWCASE_SECONDS)
  const [fromPosition, fromTarget] = s.from
  const near = Math.sin(s.t * Math.PI)
  const offset = fromPosition.clone().sub(s.center)
  const startAngle = Math.atan2(offset.x, offset.z)
  const radius = Math.hypot(offset.x, offset.z)
  const angle = startAngle + Math.sin(s.t * Math.PI) * Math.PI * 0.35
  const r = radius + (110 - radius) * near
  const y = fromPosition.y + (s.center.y + 80 - fromPosition.y) * near
  camera.position.set(s.center.x + Math.sin(angle) * r, y, s.center.z + Math.cos(angle) * r)
  controls.target.lerpVectors(fromTarget, s.center, near)
  if (s.t >= 1) {
    camera.position.copy(fromPosition)
    controls.target.copy(fromTarget)
    showcase = undefined
  }
}

function addEffect(effect: Effect, delay = 0) {
  setTimeout(() => {
    scene.add(effect.object)
    effects.push(effect)
  }, delay * 1000)
}

// 升級演出：依 celebrationFor 的計畫放星星、煙火、光柱，必要時鏡頭靠近；減少動態效果時計畫裡這些都是 0
function celebrate(plan: CelebrationPlan) {
  if (!world) return
  const { milestone } = plan
  const random = seededRandom(String(Date.now()))
  const town = milestone.kind === 'tent' || milestone.kind === 'house' || milestone.kind === 'castle'
  // 演出的地面位置與上方位置
  const base = town
    ? world.townPosition(milestone.id)
    : milestone.kind === 'flag'
      ? world.regionFlagPosition(milestone.id).sub(new THREE.Vector3(0, 26, 0))
      : world.lighthousePosition(milestone.id).sub(new THREE.Vector3(0, 36, 0))
  const top = town
    ? base.clone().add(new THREE.Vector3(0, Math.max(14, world.townHeight(milestone.id) + 4), 0))
    : base.clone().add(new THREE.Vector3(0, milestone.kind === 'flag' ? 28 : 38, 0))

  if (plan.stars) addEffect(makeStarBurst(top, random, plan.stars), 0.5)
  if (plan.pillar) addEffect(makeLightPillar(base), 0.3)
  const shots = plan.fireworks === 1 ? [[0, 8, 0, 0.7]] : plan.fireworks >= 3 ? [[0, 6, 0, 0.45], [-14, 12, 6, 0.9], [14, 8, -6, 1.3]] : []
  for (const [dx, dy, dz, delay] of shots) {
    const origin = top.clone().add(new THREE.Vector3(dx, dy, dz))
    addEffect(makeFireworks(origin, random), delay)
    setTimeout(() => {
      flashLight.position.copy(origin)
      flashAge = 0
    }, delay * 1000)
  }
  if (plan.camera) {
    flight = undefined
    showcase = { t: 0, from: [camera.position.clone(), controls.target.clone()], center: base.clone().add(new THREE.Vector3(0, 12, 0)) }
  }
}
function focusMap() {
  canvasEl.value?.focus({ preventScroll: true })
}
// 給外部（pages/index.vue 與 useMapKeyboard）控制地圖的操作
defineExpose({ celebrate, focus: focusMap, goUp, goSibling })

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
  flashLight = new THREE.PointLight('#fff1b0', 0, 160, 1.5)
  scene.add(flashLight)

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
  frame = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  controls?.dispose()
  renderer?.dispose()
})

watch(focusNode, () => {
  // 使用者換了位置，特寫中止
  showcase = undefined
  flyToFocus(true)
})
watch(answeringHere, () => flyToFocus(true))
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
  (progression) => world?.applyProgression(progression, !reduceMotion()),
)
</script>

<template>
  <div ref="wrapperEl" class="map3d" :data-mode="answeringHere ? 'answering' : 'map'" :data-view="viewKey">
    <canvas
      ref="canvasEl"
      class="canvas"
      role="img"
      tabindex="-1"
      :aria-label="mapLabel"
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
        @click="label.kind === 'start' ? emit('start', label.anchor) : label.kind === 'next' && emit('start', nextId!)"
      >
        <span
          v-if="label.progress"
          class="pie"
          :style="{ '--correct': label.progress.correct, '--wrong': label.progress.wrong }"
          :title="label.progress.text"
        />
        {{ label.text }}
        <span v-if="label.progress?.tally" class="tally">{{ label.progress.tally }}</span>
      </div>
    </div>
    <div class="camera-tools">
      <button type="button" @click="viewAll">看全部</button>
      <button v-if="focusNode.depth > 0" type="button" @click="viewCurrent">回到目前主題</button>
    </div>
    <!-- 鍵盤與螢幕閱讀器的導覽：目前這一層可以前往的位置 -->
    <nav class="sr-nav" aria-label="地圖導覽">
      <button v-if="nextHere" type="button" @click="emit('start', nextId!)">全部作答完了，下一站：{{ nextTitle }}</button>
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

/* 滑鼠點地圖時不顯示框；用鍵盤回到地圖（按 Esc）時顯示細框，看得出現在是地圖模式 */
.canvas:focus {
  outline: none;
}

.canvas:focus-visible {
  outline: 3px solid #4f8cff;
  outline-offset: -3px;
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

/* 進度圓餅：綠色是答對、紅色斜線是答錯、灰色是還沒作答；
   紅綠色弱分不出兩色，所以答錯那塊挖空，露出底下的斜線 */
.pie {
  flex: none;
  width: 14px;
  height: 14px;
  border: 1.5px solid #2b2633;
  border-radius: 50%;
  background:
    conic-gradient(
      #3a9a4a calc(var(--correct) * 360deg),
      transparent 0 calc((var(--correct) + var(--wrong)) * 360deg),
      #e8e2d4 0
    ),
    repeating-linear-gradient(45deg, #d9534f 0 2px, #f6d5d3 2px 3.5px);
}

/* 目前選到的城鎮旁的數字 */
.tally {
  padding-left: 0.35rem;
  border-left: 1px solid #d6d0c4;
  color: #4a453d;
  font-weight: 600;
  white-space: nowrap;
}

.tag--start {
  z-index: 1;
  /* 標籤層不接收點擊，只有這個標記可以點 */
  pointer-events: auto;
  cursor: pointer;
  padding: 0.25rem 0.8rem;
  border-color: #8f2a26;
  /* 白字要有 4.5:1 的對比 */
  background: #cc3a2f;
  color: #fff;
  font-size: 14px;
  animation: bob 1.6s ease-in-out infinite;
}

/* 下一站：和「從這裡開始」一樣可以點，綠色表示這個主題告一段落 */
.tag--next {
  z-index: 1;
  pointer-events: auto;
  cursor: pointer;
  padding: 0.3rem 0.8rem;
  border-color: #1d5a2a;
  /* 白字要有 4.5:1 的對比 */
  background: #2a7a38;
  color: #fff;
  font-size: 14px;
  text-align: center;
  white-space: pre-line;
  animation: bob 1.6s ease-in-out infinite;
}

.tag--next::after {
  position: absolute;
  bottom: -9px;
  left: 50%;
  border: 7px solid transparent;
  border-top-color: #1d5a2a;
  border-bottom: 0;
  content: '';
  transform: translateX(-50%);
}

.tag--answering {
  z-index: 1;
  padding: 0.25rem 0.8rem;
  border-color: #1f3f8f;
  /* 白字要有 4.5:1 的對比 */
  background: #2f5fd0;
  color: #fff;
  font-size: 14px;
}

.tag--answering::after {
  position: absolute;
  bottom: -9px;
  left: 50%;
  border: 7px solid transparent;
  border-top-color: #1f3f8f;
  border-bottom: 0;
  content: '';
  transform: translateX(-50%);
}

.tag--start::after {
  position: absolute;
  bottom: -9px;
  left: 50%;
  border: 7px solid transparent;
  border-top-color: #8f2a26;
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
  .tag--start,
  .tag--next {
    animation: none;
  }
}

/* 鏡頭按鈕：右上角，避開手機左上角的返回按鈕 */
.camera-tools {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  display: flex;
  gap: 0.4rem;
}

.camera-tools button {
  min-height: 44px;
  padding: 0 0.9rem;
  border: 2px solid #2b2633;
  border-radius: 999px;
  background: rgba(255, 253, 244, 0.92);
  box-shadow: 0 3px 0 rgba(43, 38, 51, 0.3);
  color: #2b2633;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
}

.camera-tools button:hover {
  background: #ffe9a8;
}

.camera-tools button:focus-visible {
  outline: 3px solid #4f8cff;
  outline-offset: 2px;
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
