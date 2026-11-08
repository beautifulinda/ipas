<script setup lang="ts">
import type { Concept } from '~/types/map'
import type { Attempt } from '~/utils/progress'
import { SHOW_ALL_QUESTIONS } from '~/utils/paperEntry'

// 桌面版：右側面板，地圖保持可見
// notInPaper：選了考卷、這份沒有考這個主題時的說明（「115 年第三次 第二科沒有考這個主題」），取代練習題
defineProps<{ concept: Concept; attempts: readonly Attempt[]; startQuestion?: string; notInPaper?: string }>()
const emit = defineEmits<{
  close: []
  'show-all': []
  answered: [questionId: string, choice: string, correct: boolean]
  engage: []
  position: [n: number]
}>()

const practice = ref<{ focusQuestion: () => Promise<void> }>()
defineExpose({ focusQuestion: () => practice.value?.focusQuestion() })

function onAnswered(questionId: string, choice: string, correct: boolean) {
  emit('answered', questionId, choice, correct)
}
</script>

<template>
  <aside class="panel" aria-labelledby="concept-title" data-no-map-keys>
    <header class="panel-header">
      <h2 id="concept-title" tabindex="-1">{{ concept.title }}</h2>
      <button type="button" class="close" aria-label="關閉" @click="emit('close')">✕</button>
    </header>
    <!-- 放在摘要前面，打開面板就看得到 -->
    <div v-if="notInPaper" class="not-in-paper">
      <p>{{ notInPaper }}</p>
      <button type="button" @click="emit('show-all')">{{ SHOW_ALL_QUESTIONS }}</button>
    </div>
    <ConceptSummary :concept="concept" />
    <PracticeSection
      v-if="!notInPaper"
      ref="practice"
      :concept="concept"
      :attempts="attempts"
      :start-question="startQuestion"
      @answered="onAnswered"
      @engage="emit('engage')"
      @position="emit('position', $event)"
    />
  </aside>
</template>

<style scoped>
.not-in-paper {
  padding: 0.9rem 1rem;
  border: 2px dashed #2b2633;
  border-radius: 14px;
}

.not-in-paper p {
  margin: 0 0 0.6rem;
}

.not-in-paper button {
  min-height: 44px;
  padding: 0 1.1rem;
  border: 2px solid #2b2633;
  border-radius: 999px;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  padding: 1rem 1.25rem 1.5rem;
  overflow-y: auto;
  background: #fffaf0;
  border-left: 3px solid #2b2633;
  box-sizing: border-box;
}

.panel-header {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  justify-content: space-between;
}

h2 {
  margin: 0;
  font-size: 1.3rem;
}

h2:focus {
  outline: none;
}

.close {
  flex: none;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  font-size: 1.1rem;
  cursor: pointer;
}

.close:hover,
.close:focus-visible {
  background: #f0e8d8;
}
</style>
