<script setup lang="ts">
import type { Concept } from '~/types/map'
import { practiceQuestions } from '~/utils/concepts'
import { latestByQuestion, type Attempt } from '~/utils/progress'

const props = defineProps<{ concept: Concept; attempts: readonly Attempt[] }>()
const emit = defineEmits<{ answered: [questionId: string, choice: string, correct: boolean] }>()

const questions = computed(() => practiceQuestions(props.concept))
const index = ref(0)
const current = computed(() => questions.value[index.value])
const latest = computed(() => latestByQuestion([...props.attempts]))

// 換概念時從第一題開始
watch(
  () => props.concept.id,
  () => {
    index.value = 0
  },
)

function onAnswered(choice: string, correct: boolean) {
  emit('answered', current.value.id, choice, correct)
}

function statusOf(questionId: string) {
  const attempt = latest.value.get(questionId)
  if (!attempt) return { label: '未作答', className: 'none' }
  return attempt.correct ? { label: '答對', className: 'ok' } : { label: '答錯', className: 'ng' }
}
</script>

<template>
  <section class="practice">
    <h3>練習題</h3>
    <p v-if="!questions.length" class="empty">這個主題還沒有練習題。</p>
    <template v-else>
      <nav class="question-nav" aria-label="題目">
        <button
          v-for="(question, i) in questions"
          :key="question.id"
          type="button"
          class="chip"
          :class="[statusOf(question.id).className, { active: i === index }]"
          :aria-current="i === index ? 'step' : undefined"
          :aria-label="`第 ${i + 1} 題（${statusOf(question.id).label}）`"
          @click="index = i"
        >
          {{ i + 1 }}
        </button>
      </nav>
      <QuestionCard :key="current.id" :question="current" @answered="onAnswered" />
      <button v-if="index < questions.length - 1" type="button" class="next" @click="index++">下一題 →</button>
    </template>
  </section>
</template>

<style scoped>
h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.empty {
  margin: 0;
  color: #777;
}

.question-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}

.chip {
  min-width: 44px;
  min-height: 44px;
  border: 2px solid #d6d0c4;
  border-radius: 10px;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.chip.ok {
  border-color: #3a9a4a;
  color: #2a7a38;
}

.chip.ng {
  border-color: #d9534f;
  color: #b23b37;
}

.chip.active {
  outline: 3px solid #4f8cff;
  outline-offset: 1px;
}

.next {
  min-height: 44px;
  margin-top: 0.75rem;
  padding: 0 1rem;
  border: 2px solid #2b2633;
  border-radius: 10px;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
</style>
