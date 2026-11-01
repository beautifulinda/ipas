<script setup lang="ts">
import {
  KEEP_GOING,
  LEAVE_PROMPT,
  PASS_AVERAGE,
  PASS_EACH,
  SUBMIT_CONFIRM,
  TIMED_OUT_TEXT,
  clockText,
  correctText,
  durationText,
  gradeExam,
  isTimeUp,
  remainingSeconds,
  removedText,
  scoreText,
  startExam,
  submitPrompt,
  timeWarning,
  type ExamOutcome,
  type ExamPaper,
} from '~/utils/mockExam'
import { PAST_PAPERS_LINK_TEXT, PAST_PAPERS_URL, sourceLabel } from '~/utils/pastPapers'

// 模擬考（需求在 tests/features/模擬考.feature）：桌面與手機都是全螢幕，照官方題號作答，交卷才看分數
const props = defineProps<{ paper: ExamPaper; timed: boolean }>()
const emit = defineEmits<{ close: []; submitted: [outcome: ExamOutcome] }>()

const session = reactive(startExam(props.paper, props.timed, Date.now()))
const now = ref(Date.now())
const index = ref(0)
const item = computed(() => props.paper.items[index.value])
const outcome = ref<ExamOutcome>()
// 正在詢問的事：交卷或離開
const asking = ref<'submit' | 'leave'>()
const askText = computed(() => (asking.value === 'leave' ? LEAVE_PROMPT : submitPrompt(session)))

const remaining = computed(() => remainingSeconds(session, now.value))
const warning = computed(() => (outcome.value ? undefined : timeWarning(session, now.value)))

function finish(timedOut = false) {
  if (outcome.value) return
  clearInterval(timer)
  asking.value = undefined
  outcome.value = gradeExam(session, Date.now(), timedOut)
  emit('submitted', outcome.value)
  nextTick(() => resultHeading.value?.focus())
}

// 只有計時才每秒更新；交卷後停止
let timer: ReturnType<typeof setInterval> | undefined
const resultHeading = ref<HTMLElement>()
// 關閉後焦點回到打開前的位置
let opener: HTMLElement | null = null
onMounted(() => {
  opener = document.activeElement as HTMLElement | null
  focusOptions()
  if (!props.timed) return
  timer = setInterval(() => {
    now.value = Date.now()
    // 時間到不詢問，直接交卷
    if (isTimeUp(session, now.value)) finish(true)
  }, 1000)
})
onUnmounted(() => {
  clearInterval(timer)
  if (opener?.isConnected) opener.focus({ preventScroll: true })
})

// 還有題目沒作答就先確認；全部作答過直接交卷
function onSubmit() {
  if (submitPrompt(session)) ask('submit')
  else finish()
}

function onClose() {
  if (outcome.value) emit('close')
  else ask('leave')
}

const askEl = ref<HTMLElement>()
function ask(what: 'submit' | 'leave') {
  asking.value = what
  nextTick(() => askEl.value?.querySelector<HTMLButtonElement>('button')?.focus())
}

function keepGoing() {
  asking.value = undefined
  nextTick(() => focusOptions())
}

function choose(id: string) {
  session.answers.set(item.value.number, id)
}

const optionEls = ref<HTMLButtonElement[]>([])
const tabStop = computed(() => Math.max(item.value.question.options.findIndex((o) => o.id === session.answers.get(item.value.number)), 0))

function focusOptions() {
  optionEls.value[tabStop.value]?.focus({ preventScroll: true })
}

// 上下鍵選答案（頭尾停住），左右鍵換題
function onOptionsKeydown(event: KeyboardEvent) {
  const options = item.value.question.options
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    // 還沒選時按上下都先選第一個
    const step = session.answers.has(item.value.number) ? (event.key === 'ArrowDown' ? 1 : -1) : 0
    const next = Math.min(Math.max(tabStop.value + step, 0), options.length - 1)
    choose(options[next].id)
    optionEls.value[next]?.focus()
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    go(index.value + (event.key === 'ArrowRight' ? 1 : -1))
  }
}

function go(to: number) {
  if (to < 0 || to >= props.paper.items.length) return
  index.value = to
  nextTick(() => {
    // 換題後從題目開頭看起；手機的題號列會左右滑，讓目前這題留在畫面內
    dialogEl.value?.querySelector('.exam-body')?.scrollTo({ top: 0 })
    dialogEl.value?.querySelector('.numbers [aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    focusOptions()
  })
}

// Tab 在作答畫面裡循環
const dialogEl = ref<HTMLElement>()
function trapTab(event: KeyboardEvent) {
  const focusable = [...(dialogEl.value?.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), a[href]') ?? [])]
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function optionText(question: ExamPaper['items'][number]['question'], id?: string) {
  if (!id) return '未作答'
  const option = question.options.find((o) => o.id === id)
  return option ? `${id}. ${option.text}` : id
}
</script>

<template>
  <Teleport to="body">
    <!-- Esc 在這裡就攔下：作答中先詢問要不要離開，交卷後直接關閉 -->
    <div
      ref="dialogEl"
      class="exam"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-title"
      data-no-map-keys
      @keydown.esc.stop.prevent="asking ? keepGoing() : onClose()"
      @keydown.tab="trapTab"
    >
      <header class="exam-header">
        <h2 id="exam-title">{{ paper.title }}・模擬考</h2>
        <!-- 倒數每秒更新，不讓報讀軟體每秒唸；剩 5 分鐘的提醒另外唸 -->
        <p v-if="!outcome && remaining !== undefined" class="clock" :class="{ low: warning }">
          <span class="visually-hidden">剩餘時間</span>{{ clockText(remaining) }}
        </p>
        <button v-if="!outcome" type="button" class="submit" @click="onSubmit">交卷</button>
        <button type="button" class="close" :aria-label="outcome ? '關閉' : '離開'" @click="onClose">✕</button>
      </header>
      <p class="warning" role="alert">{{ warning ?? '' }}</p>

      <div v-if="asking" ref="askEl" class="ask" role="alertdialog" aria-labelledby="exam-ask">
        <p id="exam-ask">{{ askText }}</p>
        <div class="ask-actions">
          <button type="button" @click="keepGoing">{{ KEEP_GOING }}</button>
          <button type="button" class="primary" @click="asking === 'submit' ? finish() : emit('close')">
            {{ asking === 'submit' ? SUBMIT_CONFIRM : '確定離開' }}
          </button>
        </div>
      </div>

      <div v-if="!outcome" class="exam-body" :inert="Boolean(asking)">
        <nav class="numbers" aria-label="題號">
          <button
            v-for="(entry, i) in paper.items"
            :key="entry.number"
            type="button"
            :class="{ done: session.answers.has(entry.number) }"
            :aria-current="i === index ? 'step' : undefined"
            :aria-label="`第 ${entry.number} 題${session.answers.has(entry.number) ? '，已作答' : ''}`"
            @click="go(i)"
          >
            {{ entry.number }}
          </button>
        </nav>

        <section class="question" aria-live="polite">
          <p class="number">第 {{ item.number }} 題</p>
          <p :id="`exam-stem-${item.number}`" class="stem">{{ item.question.stem }}</p>
          <p class="source">
            {{ sourceLabel(item.question) }}・<a :href="PAST_PAPERS_URL" target="_blank" rel="noopener">{{ PAST_PAPERS_LINK_TEXT }}</a>
          </p>
        </section>
        <div class="options" role="radiogroup" aria-label="選項" :aria-describedby="`exam-stem-${item.number}`" @keydown="onOptionsKeydown">
          <button
            v-for="(option, i) in item.question.options"
            :key="`${item.number}-${option.id}`"
            ref="optionEls"
            type="button"
            role="radio"
            class="option"
            :class="{ selected: session.answers.get(item.number) === option.id }"
            :aria-checked="session.answers.get(item.number) === option.id"
            :tabindex="i === tabStop ? 0 : -1"
            @click="choose(option.id)"
          >
            <span class="option-id">{{ option.id }}</span>
            <span>{{ option.text }}</span>
          </button>
        </div>
        <div class="steps">
          <button type="button" :disabled="index === 0" @click="go(index - 1)">← 上一題</button>
          <button type="button" :disabled="index === paper.items.length - 1" @click="go(index + 1)">下一題 →</button>
        </div>
      </div>

      <div v-else class="exam-body result">
        <h3 ref="resultHeading" tabindex="-1" class="score">{{ scoreText(outcome.result) }}</h3>
        <p class="summary">{{ correctText(outcome.result) }}・{{ durationText(outcome.result) }}</p>
        <p v-if="outcome.result.timedOut" class="note">{{ TIMED_OUT_TEXT }}</p>
        <p v-if="removedText(paper)" class="note">{{ removedText(paper) }}</p>
        <p class="note">及格標準：兩科同時報考時平均 {{ PASS_AVERAGE }} 分，且每科不低於 {{ PASS_EACH }} 分。答錯的題目已加進複習清單。</p>

        <h4 v-if="outcome.wrong.length">答錯 {{ outcome.wrong.length }} 題</h4>
        <ol class="wrong-list">
          <li v-for="wrong in outcome.wrong" :key="wrong.number">
            <p class="wrong-stem"><strong>第 {{ wrong.number }} 題</strong>　{{ wrong.question.stem }}</p>
            <p class="mine">你的答案：{{ optionText(wrong.question, wrong.choice) }}</p>
            <p class="official">官方答案：{{ optionText(wrong.question, wrong.question.answer) }}</p>
          </li>
        </ol>
        <button type="button" class="done-button" @click="emit('close')">回到地圖</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.exam {
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

.exam-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: max(0.5rem, env(safe-area-inset-top)) 1rem 0.5rem;
  border-bottom: 3px solid #2b2633;
}

h2 {
  flex: 1;
  margin: 0;
  font-size: 1.1rem;
}

.clock {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.clock.low {
  color: #b23b37;
}

.submit,
.primary,
.done-button {
  min-height: 44px;
  padding: 0 1.1rem;
  border: 0;
  border-radius: 10px;
  background: #2b2633;
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
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

.warning {
  margin: 0;
  padding: 0 1rem;
  color: #b23b37;
  font-weight: 800;
  text-align: center;
}

.warning:empty {
  display: none;
}

.ask {
  margin: 0.75rem 1rem 0;
  padding: 0.75rem 1rem;
  border: 2px solid #2b2633;
  border-radius: 12px;
  background: #fff1c7;
}

.ask p {
  margin: 0 0 0.5rem;
  font-weight: 700;
}

.ask-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ask-actions button:not(.primary),
.steps button {
  min-height: 44px;
  padding: 0 1rem;
  border: 2px solid #2b2633;
  border-radius: 10px;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.steps button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.exam-body {
  flex: 1;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem 1rem max(1.5rem, env(safe-area-inset-bottom));
  overflow-y: auto;
  box-sizing: border-box;
}

.numbers {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 0.3rem;
  margin-bottom: 1rem;
}

/* 窄螢幕：題號排成一列左右滑，題目才不會被擠到下面 */
@media (max-width: 600px) {
  .numbers {
    grid-auto-columns: 44px;
    grid-auto-flow: column;
    grid-template-columns: none;
    padding: 4px 2px;
    overflow-x: auto;
  }
}

.numbers button {
  min-height: 44px;
  border: 2px solid #d6d0c4;
  border-radius: 8px;
  background: #fff;
  font: inherit;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

/* 已作答：填色加底線，不只靠顏色分辨 */
.numbers button.done {
  border-color: #556274;
  background: #e3e8ef;
  text-decoration: underline;
}

.numbers button[aria-current='step'] {
  border-color: #4f8cff;
  outline: 2px solid #4f8cff;
  font-weight: 800;
}

.number {
  margin: 0;
  color: #556274;
  font-weight: 700;
}

.stem {
  margin: 0.25rem 0 0.5rem;
  font-size: 1.15rem;
  font-weight: 600;
}

.source {
  margin: 0 0 0.75rem;
  color: #556274;
  font-size: 0.9rem;
}

.source a {
  color: inherit;
  white-space: nowrap;
}

.options {
  display: grid;
  gap: 0.5rem;
}

@media (min-width: 900px) {
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
  text-align: left;
  cursor: pointer;
}

.option:hover {
  border-color: #8a7f6c;
}

.option:focus-visible {
  outline: 3px solid #4f8cff;
  outline-offset: 2px;
}

.option.selected {
  border-color: #4f8cff;
  background: #eef4ff;
}

.option-id {
  font-weight: 800;
}

.steps {
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
}

.result .score {
  margin: 0;
  font-size: 2.5rem;
}

.result .score:focus {
  outline: none;
}

.summary {
  margin: 0 0 0.5rem;
  font-weight: 700;
}

.note {
  margin: 0 0 0.4rem;
  color: #556274;
  font-size: 0.9rem;
}

h4 {
  margin: 1.25rem 0 0.5rem;
}

.wrong-list {
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
}

.wrong-list li {
  padding: 0.6rem 0;
  border-bottom: 1px solid #ece4d2;
}

.wrong-list p {
  margin: 0;
}

.mine {
  color: #a1322e;
}

.official {
  color: #2f6b3a;
  font-weight: 700;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
