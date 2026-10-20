<script setup lang="ts">
import type { Question } from '~/types/map'

const props = defineProps<{ question: Question }>()
const emit = defineEmits<{ answered: [choice: string, correct: boolean] }>()

const selected = ref<string>()
const submitted = ref(false)
const correct = computed(() => selected.value === props.question.answer)

function submit() {
  if (!selected.value || submitted.value) return
  submitted.value = true
  emit('answered', selected.value, correct.value)
}

function optionState(id: string) {
  if (!submitted.value) return selected.value === id ? 'selected' : ''
  if (id === props.question.answer) return 'answer'
  return id === selected.value ? 'wrong' : ''
}
</script>

<template>
  <div class="question">
    <p class="stem">{{ question.stem }}</p>
    <div class="options" role="group" aria-label="選項">
      <button
        v-for="option in question.options"
        :key="option.id"
        type="button"
        class="option"
        :class="optionState(option.id)"
        :aria-pressed="selected === option.id"
        :disabled="submitted"
        @click="selected = option.id"
      >
        <span class="option-id">{{ option.id }}</span>
        <span>{{ option.text }}</span>
      </button>
    </div>

    <button v-if="!submitted" type="button" class="submit" :disabled="!selected" @click="submit">送出答案</button>

    <div v-else class="feedback" :class="correct ? 'is-correct' : 'is-wrong'" role="status">
      <p class="verdict">{{ correct ? '答對了！' : `答錯了，正確答案是 ${question.answer}。` }}</p>
      <p class="explanation">{{ question.explanation }}</p>
      <p v-if="question.source.type === 'official-link' && question.source.url" class="source">
        出處：<a :href="question.source.url" target="_blank" rel="noopener">官方資料</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.stem {
  margin: 0 0 0.75rem;
  font-weight: 600;
}

.options {
  display: grid;
  gap: 0.5rem;
}

.option {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  min-height: 44px;
  padding: 0.6rem 0.75rem;
  border: 2px solid #d6d0c4;
  border-radius: 10px;
  background: #fff;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.option:hover:not(:disabled) {
  border-color: #8a7f6c;
}

.option:focus-visible {
  outline: 3px solid #4f8cff;
  outline-offset: 2px;
}

.option:disabled {
  cursor: default;
}

.option-id {
  font-weight: 800;
}

.option.selected {
  border-color: #4f8cff;
  background: #eef4ff;
}

.option.answer {
  border-color: #3a9a4a;
  background: #eaf7ec;
}

.option.wrong {
  border-color: #d9534f;
  background: #fdeceb;
}

.submit {
  min-height: 44px;
  margin-top: 0.75rem;
  padding: 0 1.25rem;
  border: 0;
  border-radius: 10px;
  background: #2b2633;
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.submit:disabled {
  background: #b9b3a8;
  cursor: not-allowed;
}

.feedback {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border-radius: 10px;
}

.feedback p {
  margin: 0;
}

.feedback p + p {
  margin-top: 0.4rem;
}

.is-correct {
  background: #eaf7ec;
}

.is-wrong {
  background: #fdeceb;
}

.verdict {
  font-weight: 800;
}
</style>
