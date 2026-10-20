<script setup lang="ts">
import type { Concept } from '~/types/map'
import type { Attempt } from '~/utils/progress'

// 手機版：全螢幕作答
defineProps<{ concept: Concept; attempts: readonly Attempt[] }>()
const emit = defineEmits<{ close: []; answered: [questionId: string, choice: string, correct: boolean] }>()

const closeButton = ref<HTMLButtonElement>()
onMounted(() => closeButton.value?.focus())

function onAnswered(questionId: string, choice: string, correct: boolean) {
  emit('answered', questionId, choice, correct)
}
</script>

<template>
  <Teleport to="body">
    <!-- Esc 在這裡就攔下，只關閉作答畫面，不會讓地圖回上一層 -->
    <div
      class="quiz"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-title"
      data-no-map-keys
      @keydown.esc.stop.prevent="emit('close')"
    >
      <header class="quiz-header">
        <h2 id="quiz-title">{{ concept.title }}・練習</h2>
        <button ref="closeButton" type="button" class="close" aria-label="結束練習" @click="emit('close')">✕</button>
      </header>
      <div class="quiz-body">
        <PracticeSection :concept="concept" :attempts="attempts" @answered="onAnswered" />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.quiz {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  background: #fffaf0;
  font-family: system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', sans-serif;
  line-height: 1.6;
  color: #1e293b;
}

.quiz-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  padding: max(0.5rem, env(safe-area-inset-top)) 1rem 0.5rem;
  border-bottom: 3px solid #2b2633;
}

h2 {
  margin: 0;
  font-size: 1.15rem;
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

.quiz-body {
  flex: 1;
  padding: 1rem 1rem max(1.5rem, env(safe-area-inset-bottom));
  overflow-y: auto;
}
</style>
