<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import type { TopicMap } from '~/types/map'
import mapData from '~/data/map.sample.json'
import { findConcept } from '~/utils/concepts'
import { ROOT_ID, findPath, toMapTree } from '~/utils/mapTree'

const map = mapData as TopicMap
const tree = toMapTree(map)

const focusId = ref(ROOT_ID)
const path = computed(() => findPath(tree, focusId.value))
// 聚焦到主題概念（城鎮）時打開概念面板
const concept = computed(() => findConcept(map, focusId.value))

const { isMobile } = useDevice()
const { attempts, record } = useRecords()
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
watch(concept, () => {
  quizOpen.value = false
})

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
    <header class="header">
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
      <p class="disclaimer">{{ map.disclaimer }}</p>
      <MapBreadcrumb :path="path" @navigate="focusId = $event" />
    </header>

    <main ref="mainEl" class="main" :class="{ 'has-panel': concept && !isMobile }">
      <div class="map-area">
        <TopicMap v-if="view === 'map'" v-model:focus-id="focusId" :tree="tree" :inset-bottom="insetBottom" />
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
          :attempts="attempts"
          @close="goUp"
          @answered="onAnswered"
        />
      </template>
    </main>

    <QuizScreen
      v-if="concept && isMobile && quizOpen"
      :concept="concept"
      :attempts="attempts"
      @close="quizOpen = false"
      @answered="onAnswered"
    />

    <footer class="hint">
      <template v-if="isMobile">點擊放大・雙指縮放・拖曳平移・左上角按鈕或返回手勢回上一層</template>
      <template v-else>點擊節點放大・滾輪縮放・拖曳平移・Esc 返回上一層・方向鍵切換同層</template>
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

.hint {
  padding: 0.5rem 1.5rem;
  color: #64748b;
  font-size: 0.8rem;
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
