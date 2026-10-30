<script setup lang="ts">
import type { Concept } from '~/types/map'
import type { Attempt } from '~/utils/progress'

// 桌面版：右側面板，地圖保持可見
defineProps<{ concept: Concept; attempts: readonly Attempt[]; startQuestion?: string }>()
const emit = defineEmits<{
  close: []
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
    <ConceptSummary :concept="concept" />
    <PracticeSection
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
