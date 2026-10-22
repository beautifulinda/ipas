<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import type { TopicMap } from '~/types/map'
// 正式網站是 data/map.json；E2E 測試時換成假題庫（見 nuxt.config.ts）
import mapData from '#map-data'
import { findConcept, practiceQuestions } from '~/utils/concepts'
import { COPYRIGHT_NOTICE, mergePastPapers } from '~/utils/pastPapers'
import { withExtraQuestions, type ExtraQuestion } from '~/utils/questionBank'
import { ROOT_ID, findPath, toMapTree } from '~/utils/mapTree'
import {
  PLAQUE_RIBBON,
  celebrationFor,
  computeProgression,
  expansionNotices,
  expansionText,
  milestoneText,
  newMilestones,
  recommendedStart,
  townSnapshot,
  type CelebrationPlan,
  type TownSnapshot,
} from '~/utils/progression'

// 官方公告試題放在私人 repo，本機是 data/private/（#private-data），部署時由 GitHub Actions 讀進來；檔案不存在時就只用正式題庫
// 同一題在不同場次考過時合併成一題，出處列出每一次
const privateBanks = import.meta.glob<{ questions: ExtraQuestion[] }>('#private-data/past-papers.json', {
  eager: true,
  import: 'default',
})
const pastPapers = mergePastPapers(Object.values(privateBanks).flatMap((bank) => bank.questions)).items
const map = withExtraQuestions(mapData as TopicMap, pastPapers)
const tree = toMapTree(map)

const focusId = ref(ROOT_ID)
const path = computed(() => findPath(tree, focusId.value))
// 聚焦到主題概念（城鎮）時打開概念面板
const concept = computed(() => findConcept(map, focusId.value))

const { isMobile } = useDevice()
const { attempts, ready, record } = useRecords()
const { soundOn, play } = useSound()
useFocusHistory(focusId, tree)

// 地圖／清單模式，選擇記在瀏覽器
const VIEW_KEY = 'ipas:view'
const view = ref<'map' | 'list'>('map')
onMounted(() => {
  if (localStorage.getItem(VIEW_KEY) === 'list') view.value = 'list'
})
watch(view, (value) => localStorage.setItem(VIEW_KEY, value))

// 手機：bottom sheet 預設佔下半部，地圖改對準上半部；練習題以全螢幕作答
const mainEl = ref<HTMLElement>()
const { height: mainHeight } = useElementSize(mainEl)
const insetBottom = computed(() => (isMobile.value && concept.value ? mainHeight.value * 0.5 : 0))
const quizOpen = ref(false)
// 作答模式（桌面）：鍵盤在右邊的題目上，地圖放大到建築物；換主題就回到地圖模式（需求在 tests/features/鍵盤作答.feature）
const answering = ref(false)
const questionNumber = ref(1)
watch(concept, () => {
  quizOpen.value = false
  answering.value = false
})
// 全螢幕作答時，背景的頁首、地圖、面板、頁尾設為 inert，Tab 與報讀軟體都不會跑到後面；升級卡不在其中，照樣唸得出來
const quizShown = computed(() => Boolean(concept.value && isMobile.value && quizOpen.value))

// 熟練度：城鎮等級、雲霧、旗子、燈塔都由作答紀錄算出
const progression = computed(() => computeProgression(map, attempts.value))
// 建議從哪裡開始；等紀錄載入完成才顯示，避免老使用者一打開先看到標記又消失
const startId = computed(() => (ready.value ? recommendedStart(map, progression.value) : undefined))
const mapRef = ref<{ celebrate: (plan: CelebrationPlan) => void; focusMap: () => void }>()
const panelRef = ref<{ focusQuestion: () => Promise<void> }>()
const confettiRef = ref<{ burst: (count: number) => void }>()

// 升級演出（需求在 tests/features/升級演出.feature）：同時達成好幾個里程碑只演最大的那一個；
// 帳篷、房子跳出升級卡，城堡、插旗、燈塔出現有皇冠的里程碑匾額；剛載入紀錄時不算
interface Toast {
  id: number
  text: string
}
interface Banner {
  id: number
  plan: CelebrationPlan
}
const toasts = ref<Toast[]>([])
const cards = ref<Banner[]>([])
const plaques = ref<Banner[]>([])
let toastId = 0
// 紀錄載入完成後的下一輪才開始偵測，載入舊紀錄造成的變化不算「剛達成」
let armed = false
function showToast(text: string, ms = 3000) {
  const id = ++toastId
  toasts.value.push({ id, text })
  setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), ms)
}

// 題庫新增考古題造成城鎮降級時，打開網站說明一次原因；每次等級變化都記下來供下次比較
const TOWNS_KEY = 'ipas:towns'
function readSnapshot(): TownSnapshot | undefined {
  try {
    return JSON.parse(localStorage.getItem(TOWNS_KEY) ?? 'null') ?? undefined
  } catch {
    return undefined
  }
}
function saveSnapshot() {
  try {
    localStorage.setItem(TOWNS_KEY, JSON.stringify(townSnapshot(map, progression.value)))
  } catch {
    // 瀏覽器不允許儲存時就不提示，不影響練習
  }
}
watch(
  ready,
  (value) => {
    if (!value) return
    nextTick(() => {
      const notices = expansionNotices(map, readSnapshot(), townSnapshot(map, progression.value))
      if (notices.length > 3) showToast(`有 ${notices.length} 個主題新增了考古題，等級依新的題數重新計算`, 6000)
      else for (const notice of notices) showToast(expansionText(notice), 6000)
      saveSnapshot()
      armed = true
    })
  },
  { immediate: true },
)
watch(progression, (after, before) => {
  if (!armed || !before) return
  saveSnapshot()
  const plan = celebrationFor(newMilestones(map, before, after), {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    soundOn: soundOn.value,
  })
  if (!plan) return
  play(plan.sound)
  mapRef.value?.celebrate(plan)
  if (plan.confetti !== 'none') {
    const count = plan.confetti === 'many' ? 160 : 60
    setTimeout(() => confettiRef.value?.burst(count), plan.banner === 'plaque' ? 400 : 600)
  }
  const id = ++toastId
  const list = plan.banner === 'plaque' ? plaques : cards
  list.value.push({ id, plan })
  setTimeout(() => (list.value = list.value.filter((b) => b.id !== id)), plan.banner === 'plaque' ? 5000 : 3200)
})

// 點「從這裡開始」：前往那個主題並直接顯示題目（手機開全螢幕作答，桌面捲到練習題）
async function onStart(conceptId: string) {
  focusId.value = conceptId
  await nextTick()
  if (isMobile.value) {
    quizOpen.value = true
    return
  }
  document.querySelector('.practice')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  await enterAnswering()
}

// 進入作答：焦點移到題目的選項，報讀軟體會先唸出題目；主題沒有題目時不進入
async function enterAnswering() {
  if (!concept.value || !practiceQuestions(concept.value).length) return
  answering.value = true
  await panelRef.value?.focusQuestion()
}

// 在地圖的主題上按 Enter：手機開全螢幕作答，桌面進入作答模式
async function onEnter() {
  if (isMobile.value) quizOpen.value = true
  else await enterAnswering()
}

// 作答中按 Esc：回到地圖模式，焦點回到地圖，報讀軟體會唸出目前的位置
function onLeave() {
  answering.value = false
  mapRef.value?.focusMap()
}

function goUp() {
  const parent = path.value[path.value.length - 2]
  if (parent) focusId.value = parent.id
}

function onAnswered(questionId: string, choice: string, correct: boolean) {
  if (!concept.value) return
  record({ questionId, conceptId: concept.value.id, choice, correct, answeredAt: new Date().toISOString() })
}
</script>

<template>
  <div class="layout" :class="{ mobile: isMobile }">
    <header class="header" :inert="quizShown">
      <div class="title-row">
        <h1>iPAS AI 應用規劃師（初級）主題地圖</h1>
        <div class="tools">
          <div class="view-switch" role="group" aria-label="檢視方式">
            <button type="button" :aria-pressed="view === 'map'" @click="view = 'map'">地圖</button>
            <button type="button" :aria-pressed="view === 'list'" @click="view = 'list'">清單</button>
          </div>
          <RecordMenu :map="map" @navigate="focusId = $event" />
        </div>
      </div>
      <p class="disclaimer">
        {{ map.disclaimer }}
        <template v-if="map.scopeSource">
          資料來源：經濟部產業人才能力鑑定（iPAS）官網
          <a :href="map.scopeSource.url" target="_blank" rel="noopener">〈{{ map.scopeSource.title }}〉</a>。
        </template>
      </p>
      <MapBreadcrumb :path="path" @navigate="focusId = $event" />
    </header>

    <main ref="mainEl" class="main" :class="{ 'has-panel': concept && !isMobile }" :inert="quizShown">
      <div class="map-area">
        <IslandMap3D
          v-if="view === 'map'"
          ref="mapRef"
          v-model:focus-id="focusId"
          :tree="tree"
          :progression="progression"
          :start-id="startId"
          :answering="answering && !isMobile"
          :question-number="questionNumber"
          @start="onStart"
          @enter="onEnter"
          @leave="onLeave"
          :inset-bottom="insetBottom"
          @unsupported="view = 'list'"
        />
        <ListView v-else :map="map" :focus-id="focusId" :attempts="attempts" @navigate="focusId = $event" />
        <!-- 手機：左上角的返回按鈕（也可以用系統的返回手勢） -->
        <button
          v-if="isMobile && view === 'map' && path.length > 1"
          type="button"
          class="back"
          aria-label="回上一層"
          @click="goUp"
        >
          ←
        </button>
      </div>

      <template v-if="concept">
        <ConceptSheet
          v-if="isMobile"
          :concept="concept"
          :attempts="attempts"
          @close="goUp"
          @start-quiz="quizOpen = true"
        />
        <ConceptPanel
          v-else
          class="panel-area"
          :concept="concept"
          ref="panelRef"
          :attempts="attempts"
          @close="goUp"
          @answered="onAnswered"
          @engage="answering = true"
          @position="questionNumber = $event"
        />
      </template>
    </main>

    <QuizScreen
      v-if="concept && quizShown"
      :concept="concept"
      :attempts="attempts"
      @close="quizOpen = false"
      @answered="onAnswered"
    />

    <!-- 升級卡（帳篷、房子）與題庫擴充的提示 -->
    <div class="toasts" role="status" aria-live="polite">
      <UpgradeCard
        v-for="card in cards"
        :key="card.id"
        :kind="card.plan.milestone.kind === 'tent' ? 'tent' : 'house'"
        :text="milestoneText(card.plan.milestone)"
      />
      <p v-for="toast in toasts" :key="toast.id" class="toast">{{ toast.text }}</p>
    </div>

    <!-- 大事件的里程碑匾額（城堡、插旗、燈塔），點一下就關閉 -->
    <div class="plaques" role="status" aria-live="polite">
      <MilestonePlaque
        v-for="plaque in plaques"
        :key="plaque.id"
        :text="milestoneText(plaque.plan.milestone)"
        :ribbon="PLAQUE_RIBBON[plaque.plan.milestone.kind as keyof typeof PLAQUE_RIBBON]"
        @close="plaques = plaques.filter((p) => p.id !== plaque.id)"
      />
    </div>

    <ConfettiBurst ref="confettiRef" />

    <footer class="hint" :inert="quizShown">
      <template v-if="isMobile">點擊放大・雙指縮放・拖曳平移・左上角按鈕或返回手勢回上一層</template>
      <template v-else>點擊節點放大・滾輪縮放・拖曳平移・方向鍵切換同層・Enter 作答・Esc 返回</template>
      <span v-if="pastPapers.length" class="copyright">{{ COPYRIGHT_NOTICE }}。</span>
    </footer>
  </div>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', sans-serif;
  line-height: 1.6;
  color: #1e293b;
}

.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
}

.header {
  padding: 1rem 1.5rem 0.5rem;
}

.title-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

.header h1 {
  margin: 0;
  font-size: 1.4rem;
}

.tools {
  display: flex;
  flex: none;
  gap: 0.5rem;
  align-items: center;
}

.view-switch {
  display: flex;
  border: 2px solid #2b2633;
  border-radius: 999px;
  overflow: hidden;
}

.view-switch button {
  min-width: 44px;
  min-height: 40px;
  padding: 0 0.8rem;
  border: 0;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.view-switch button[aria-pressed='true'] {
  background: #2b2633;
  color: #fff;
}

.disclaimer {
  margin: 0.25rem 0 0.75rem;
  color: #555;
  font-size: 0.85rem;
}

.disclaimer a {
  color: inherit;
}

.main {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 桌面：概念面板在右側，地圖保持可見 */
.main.has-panel {
  grid-template-columns: 1fr minmax(320px, 400px);
}

.map-area {
  position: relative;
  min-width: 0;
  min-height: 0;
}

.panel-area {
  min-height: 0;
}

.back {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 4;
  width: 48px;
  height: 48px;
  border: 3px solid #2b2633;
  border-radius: 50%;
  background: #fff7dc;
  box-shadow: 0 3px 0 rgba(43, 38, 51, 0.35);
  font-size: 1.4rem;
  font-weight: 800;
  cursor: pointer;
}

.toasts {
  position: fixed;
  top: 1rem;
  left: 50%;
  z-index: 60;
  display: grid;
  gap: 0.5rem;
  transform: translateX(-50%);
  pointer-events: none;
}

.toast {
  margin: 0;
  padding: 0.6rem 1.2rem;
  border: 3px solid #2b2633;
  border-radius: 999px;
  background: #ffe9a8;
  box-shadow: 0 4px 0 rgba(43, 38, 51, 0.35);
  font-weight: 800;
  max-width: min(32rem, 90vw);
  text-align: center;
  animation: pop 0.35s ease-out;
}

@keyframes pop {
  from {
    transform: scale(0.6);
    opacity: 0;
  }
}

.plaques {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 70;
  display: grid;
  gap: 0.75rem;
  transform: translate(-50%, -50%);
}

@media (prefers-reduced-motion: reduce) {
  .toast {
    animation: none;
  }
}

.hint {
  padding: 0.5rem 1.5rem;
  color: #64748b;
  font-size: 0.8rem;
}

.copyright {
  display: block;
}

/* 手機：標題獨佔一行、工具按鈕排在下一行，地圖盡量大 */
.mobile .header {
  padding: 0.6rem 0.9rem 0.25rem;
}

.mobile .title-row {
  flex-wrap: wrap;
  gap: 0.4rem;
}

.mobile .title-row h1 {
  flex: 1 1 100%;
}

.mobile .tools {
  flex: 1 1 100%;
  justify-content: space-between;
}

.mobile .header h1 {
  font-size: 1.05rem;
}

.mobile .disclaimer {
  margin: 0.15rem 0 0.25rem;
  font-size: 0.72rem;
  line-height: 1.4;
}

.mobile .hint {
  padding: 0.35rem 0.9rem calc(0.35rem + env(safe-area-inset-bottom));
  font-size: 0.72rem;
}
</style>
