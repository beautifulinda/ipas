<script setup lang="ts">
import type { Question } from '~/types/map'
import {
  PAST_PAPERS_LINK_TEXT,
  PAST_PAPERS_URL,
  explanationText,
  isPastPaper,
  sourceBadge,
  sourceLabel,
  verdictText,
} from '~/utils/pastPapers'

const props = defineProps<{ question: Question }>()
const emit = defineEmits<{ answered: [choice: string, correct: boolean] }>()

const selected = ref<string>()
const submitted = ref(false)
const correct = computed(() => selected.value === props.question.answer)
const feedbackEl = ref<HTMLElement>()
const optionEls = ref<HTMLButtonElement[]>([])
// 還沒選答案就按 Enter 時的提示
const hint = ref('')
const stemId = computed(() => `stem-${props.question.id}`)
// 單選題的鍵盤操作：整組選項只有一個能用 Tab 移到（選了的那個，還沒選就是第一個）
const tabStop = computed(() => Math.max(props.question.options.findIndex((o) => o.id === selected.value), 0))

function choose(id: string) {
  selected.value = id
  hint.value = ''
}

// 送出後焦點移到哪裡由 PracticeSection 決定（作答結果或錯題本詢問）
function submit() {
  if (!selected.value || submitted.value) return
  submitted.value = true
  emit('answered', selected.value, correct.value)
}

// 鍵盤作答（需求在 tests/features/鍵盤作答.feature）：上下鍵選答案、Enter 送出；左右鍵換題交給 PracticeSection
function onOptionsKeydown(event: KeyboardEvent) {
  if (submitted.value) return
  const options = props.question.options
  const current = options.findIndex((o) => o.id === selected.value)
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    // 還沒選時按上下鍵都先選第一個；到頭尾時停住
    const next = current < 0 ? 0 : Math.min(Math.max(current + (event.key === 'ArrowDown' ? 1 : -1), 0), options.length - 1)
    choose(options[next].id)
    optionEls.value[next]?.focus()
  } else if (event.key === 'Enter') {
    // 攔下 Enter，免得按鈕把它當成點選
    event.preventDefault()
    if (selected.value) submit()
    else hint.value = '請先選一個答案'
  }
}

function focusOptions() {
  if (submitted.value) feedbackEl.value?.focus({ preventScroll: true })
  else optionEls.value[tabStop.value]?.focus()
}

function focusFeedback() {
  feedbackEl.value?.focus({ preventScroll: true })
}

defineExpose({ focusOptions, focusFeedback })

function optionState(id: string) {
  if (!submitted.value) return selected.value === id ? 'selected' : ''
  if (id === props.question.answer) return 'answer'
  return id === selected.value ? 'wrong' : ''
}
</script>

<template>
  <div class="question">
    <p class="badge" :class="{ past: isPastPaper(question) }">{{ sourceBadge(question) }}</p>
    <p :id="stemId" class="stem">{{ question.stem }}</p>
    <p v-if="sourceLabel(question)" class="source">
      {{ sourceLabel(question) }}・<a :href="PAST_PAPERS_URL" target="_blank" rel="noopener">{{ PAST_PAPERS_LINK_TEXT }}</a>
    </p>
    <!-- 報讀軟體進到選項時，會先唸出題目（aria-describedby） -->
    <div class="options" role="radiogroup" aria-label="選項" :aria-describedby="stemId" @keydown="onOptionsKeydown">
      <button
        v-for="(option, i) in question.options"
        :key="option.id"
        ref="optionEls"
        type="button"
        role="radio"
        class="option"
        :class="optionState(option.id)"
        :aria-checked="selected === option.id"
        :tabindex="i === tabStop ? 0 : -1"
        :disabled="submitted"
        @click="choose(option.id)"
      >
        <span class="option-id">{{ option.id }}</span>
        <span>{{ option.text }}</span>
      </button>
    </div>
    <p v-if="hint" class="hint" role="status">{{ hint }}</p>

    <button v-if="!submitted" type="button" class="submit" :disabled="!selected" @click="submit">送出答案</button>

    <div v-else ref="feedbackEl" class="feedback" :class="correct ? 'is-correct' : 'is-wrong'" tabindex="-1">
      <p class="verdict">{{ verdictText(question, correct) }}</p>
      <p class="explanation" :class="{ muted: !question.explanation }">{{ explanationText(question) }}</p>
      <p v-if="question.source.type === 'official-link' && question.source.url" class="source">
        出處：<a :href="question.source.url" target="_blank" rel="noopener">官方資料</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.badge {
  display: inline-block;
  margin: 0 0 0.4rem;
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  background: #eef1f5;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 700;
}

.badge.past {
  background: #fff1c2;
  color: #7a5a12;
}

.stem {
  margin: 0 0 0.75rem;
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.6;
}

.stem + .source {
  margin: -0.4rem 0 0.75rem;
}

.source a {
  color: inherit;
  /* 連結文字整段一起換行，不會剩一個字掉到下一行 */
  white-space: nowrap;
}

/* 觸控裝置：出處連結的可點範圍加高到 44px；行內元素的上下 padding 不會撐開行高，畫面不變 */
@media (pointer: coarse) {
  .source a {
    padding-block: 14px;
  }
}

.question {
  container-type: inline-size;
}

.options {
  display: grid;
  gap: 0.5rem;
}

/* 面板夠寬時（桌面作答）選項排成兩欄，左到右、上到下是 A B／C D；手機與窄面板維持一欄 */
@container (min-width: 720px) {
  .options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
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
  font-size: 1.05rem;
  line-height: 1.55;
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

.hint {
  margin: 0.5rem 0 0;
  color: #9a3412;
  font-weight: 700;
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

.feedback:focus {
  outline: none;
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

.muted,
.source {
  /* 在答錯的淡紅底上也要有 4.5:1 的對比 */
  color: #556274;
  font-size: 0.9rem;
}
</style>
