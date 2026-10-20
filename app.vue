<script setup lang="ts">
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

const { attempts, record } = useRecords()

function closePanel() {
  const parent = path.value[path.value.length - 2]
  if (parent) focusId.value = parent.id
}

function onAnswered(questionId: string, choice: string, correct: boolean) {
  if (!concept.value) return
  record({ questionId, conceptId: concept.value.id, choice, correct, answeredAt: new Date().toISOString() })
}
</script>

<template>
  <div class="layout">
    <header class="header">
      <div class="title-row">
        <h1>iPAS AI 應用規劃師（初級）主題地圖</h1>
        <RecordMenu :map="map" @navigate="focusId = $event" />
      </div>
      <p class="disclaimer">{{ map.disclaimer }}</p>
      <MapBreadcrumb :path="path" @navigate="focusId = $event" />
    </header>

    <main class="main" :class="{ 'has-panel': concept }">
      <div class="map-area">
        <TopicMap v-model:focus-id="focusId" :tree="tree" />
      </div>
      <ConceptPanel
        v-if="concept"
        class="panel-area"
        :concept="concept"
        :attempts="attempts"
        @close="closePanel"
        @answered="onAnswered"
      />
    </main>

    <footer class="hint">點擊節點放大・滾輪縮放・拖曳平移・Esc 返回上一層・方向鍵切換同層</footer>
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
}

/* 桌面：概念面板在右側，地圖保持可見 */
.main.has-panel {
  grid-template-columns: 1fr minmax(320px, 400px);
}

.map-area {
  min-width: 0;
  min-height: 0;
}

.panel-area {
  min-height: 0;
}

/* 窄螢幕：面板暫時從底部疊在地圖上（完整的 bottom sheet 在手機版步驟處理） */
@media (max-width: 768px) {
  .main.has-panel {
    grid-template-columns: 1fr;
  }

  .main .panel-area {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 65%;
    border-top: 3px solid #2b2633;
    border-left: 0;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -6px 16px rgba(0, 0, 0, 0.15);
  }
}

.hint {
  padding: 0.5rem 1.5rem;
  color: #64748b;
  font-size: 0.8rem;
}
</style>
