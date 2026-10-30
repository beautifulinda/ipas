<script setup lang="ts">
import type { Concept } from '~/types/map'
import { practiceQuestions } from '~/utils/concepts'
import { DISMISS_PROMPT, latestByQuestion, resumeIndex, shouldAskDismiss, type Attempt } from '~/utils/progress'
import { groupOf, groupProgressText, questionGroups, shownRange } from '~/utils/questionGroups'

// startQuestion：從複習清單點進來時要直接打開的題目
const props = defineProps<{ concept: Concept; attempts: readonly Attempt[]; startQuestion?: string }>()
// engage：使用者開始操作題目（點了或用鍵盤進入），地圖切成作答模式；position：目前是第幾題（從 1 起算）
const emit = defineEmits<{
  answered: [questionId: string, choice: string, correct: boolean]
  engage: []
  position: [n: number]
}>()

const { dismissals, dismiss, ready, markedQuestionIds, mark } = useRecords()
const questions = computed(() => practiceQuestions(props.concept))
// 打開主題時接著上次的進度：第一題還沒作答的題目（需求在 tests/features/繼續作答.feature）；
// 從複習清單點進來時直接打開那一題
function startIndex() {
  const requested = questions.value.findIndex((q) => q.id === props.startQuestion)
  return requested >= 0 ? requested : resumeIndex(questions.value.map((q) => q.id), [...props.attempts])
}
const index = ref(startIndex())
const current = computed(() => questions.value[index.value])
const latest = computed(() => latestByQuestion([...props.attempts]))

// 錯題本的題目答對時，詢問是否移除；不回答或換題就當作先保留
const dismissPrompt = ref<'ask' | 'removed'>()

// 使用者自己換過題（點題號、左右鍵、進入作答）後，就不再自動跳題
let moved = false
// 換主題時重新決定從哪一題開始；作答中不會自動跳題
watch(
  () => props.concept.id,
  () => {
    moved = false
    index.value = startIndex()
  },
)
// 重新整理網頁時，作答紀錄可能在主題打開後才載入完成，載入後再跳到上次的進度；使用者已經換過題就不跳
watch(ready, (value) => {
  if (value && !moved) index.value = startIndex()
})
watch(current, () => {
  dismissPrompt.value = undefined
})
// 從複習清單點了同一個主題的另一題時，主題沒變，要另外跳過去
watch(
  () => props.startQuestion,
  () => {
    const requested = questions.value.findIndex((q) => q.id === props.startQuestion)
    if (requested >= 0) {
      moved = true
      index.value = requested
    }
  },
)

// 自己標記不熟（需求在 tests/features/標記不熟.feature）：答對也不會拿掉，只有按「我懂了」才拿掉；
// 放在題目上方，送出答案後按 Tab 才會直接到「下一題」（無障礙.feature）；
// 按鈕換掉後焦點移到新的按鈕，鍵盤與報讀軟體使用者才不會被丟回頁首
const isMarked = computed(() => markedQuestionIds.value.includes(current.value.id))
const markEl = ref<HTMLElement>()
async function setMarked(marked: boolean) {
  await mark(current.value.id, marked)
  await nextTick()
  markEl.value?.querySelector('button')?.focus()
}
watch(index, (i) => emit('position', i + 1), { immediate: true })

// 超過 10 題時題號分組，一次只顯示一組（需求在 tests/features/題號分組.feature）；
// 點組名只換顯示的題號、不換題，換到別組的題目時跟著顯示那一組
const groups = computed(() => questionGroups(questions.value.length))
const shownGroup = ref(groupOf(index.value))
// 換主題時題號可能剛好沒變，所以主題也要看
watch([index, () => props.concept.id], () => (shownGroup.value = groupOf(index.value)))
const shownQuestions = computed(() => {
  const { start, end } = shownRange(questions.value.length, shownGroup.value)
  return questions.value.map((question, i) => ({ question, i })).slice(start, end)
})
function correctIn(start: number, end: number) {
  return questions.value.slice(start, end).filter((q) => latest.value.get(q.id)?.correct).length
}

const card = ref<{ focusOptions: () => void; focusFeedback: () => void }>()
const dismissEl = ref<HTMLElement>()
const dismissDoneEl = ref<HTMLElement>()

// 鍵盤進入作答：接著上次的進度，焦點移到選項（報讀軟體會先唸出題目）
async function focusQuestion() {
  moved = true
  index.value = startIndex()
  await nextTick()
  card.value?.focusOptions()
}
defineExpose({ focusQuestion })

async function goTo(i: number) {
  if (i < 0 || i >= questions.value.length || i === index.value) return
  moved = true
  index.value = i
  await nextTick()
  card.value?.focusOptions()
}

async function onAnswered(choice: string, correct: boolean) {
  const id = current.value.id
  // 要在記下這次作答之前判斷題目是否在錯題本裡
  dismissPrompt.value = shouldAskDismiss(id, correct, props.attempts, dismissals.value) ? 'ask' : undefined
  emit('answered', id, choice, correct)
  // 送出按鈕會消失：有錯題本詢問就停在詢問的「移除」，否則停在作答結果，報讀軟體使用者才不會被丟回頁首
  await nextTick()
  if (dismissPrompt.value === 'ask') dismissEl.value?.querySelector('button')?.focus()
  else card.value?.focusFeedback()
}

async function onDismiss() {
  await dismiss(current.value.id)
  dismissPrompt.value = 'removed'
  await nextTick()
  dismissDoneEl.value?.focus({ preventScroll: true })
}

async function onKeep() {
  dismissPrompt.value = undefined
  await nextTick()
  card.value?.focusFeedback()
}

// 鍵盤作答（需求在 tests/features/鍵盤作答.feature）：左右鍵換題，到頭尾停住；
// 送出後在作答結果按 Enter 到下一題；錯題本詢問用左右鍵在「移除」「先保留」之間切換
function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
  if (target.closest('.dismiss')) {
    if (!horizontal) return
    event.preventDefault()
    const buttons = [...(dismissEl.value?.querySelectorAll('button') ?? [])]
    buttons[event.key === 'ArrowLeft' ? 0 : buttons.length - 1]?.focus()
  } else if (horizontal && target.closest('.question')) {
    event.preventDefault()
    goTo(index.value + (event.key === 'ArrowLeft' ? -1 : 1))
  } else if (event.key === 'Enter' && (target.matches('.feedback') || target === dismissDoneEl.value)) {
    event.preventDefault()
    goTo(index.value + 1)
  }
}

// 作答模式會把面板放寬、選項跟著移位。用滑鼠時若在按下去（focusin）就切換，放開時指標已不在原本的選項上，
// 這次點擊會被吃掉；所以滑鼠等點擊完成（capture 階段，選項自己的 click 照常處理）才切換，鍵盤維持 focusin
let pointerEngaging = false

function onFocusin() {
  if (!pointerEngaging) emit('engage')
}

function onClickCapture(event: MouseEvent) {
  if (!pointerEngaging) return
  pointerEngaging = false
  // 和 focusin 一樣，只有點到按鈕、連結這類會拿到焦點的元素才算開始作答
  if ((event.target as HTMLElement).closest('button, a')) emit('engage')
}

function statusOf(questionId: string) {
  const attempt = latest.value.get(questionId)
  if (!attempt) return { label: '未作答', className: 'none' }
  return attempt.correct ? { label: '答對', className: 'ok' } : { label: '答錯', className: 'ng' }
}
</script>

<template>
  <section
    class="practice"
    @pointerdown="pointerEngaging = true"
    @pointercancel="pointerEngaging = false"
    @focusin="onFocusin"
    @click.capture="onClickCapture"
    @keydown="onKeydown"
  >
    <h3>練習題</h3>
    <p v-if="!questions.length" class="empty">這個主題還沒有練習題。</p>
    <template v-else>
      <div v-if="groups.length" class="group-nav" role="group" aria-label="題號分組">
        <button
          v-for="(group, g) in groups"
          :key="group.start"
          type="button"
          class="group"
          :class="{ shown: g === shownGroup, current: g === groupOf(index) }"
          :aria-pressed="g === shownGroup"
          :aria-label="`第 ${group.label} 題，答對 ${correctIn(group.start, group.end)} 題`"
          @click="shownGroup = g"
        >
          <span class="group-label">{{ group.label }}</span>
          <span class="group-count">{{ groupProgressText(group, correctIn(group.start, group.end)) }}</span>
        </button>
      </div>
      <nav class="question-nav" aria-label="題目">
        <button
          v-for="{ question, i } in shownQuestions"
          :key="question.id"
          type="button"
          class="chip"
          :class="[statusOf(question.id).className, { active: i === index }]"
          :aria-current="i === index ? 'step' : undefined"
          :aria-label="`第 ${i + 1} 題（${statusOf(question.id).label}）`"
          @click="goTo(i)"
        >
          {{ i + 1 }}
        </button>
      </nav>
      <div ref="markEl" class="mark" :class="{ marked: isMarked }">
        <template v-if="isMarked">
          <span class="mark-text">🔖 已標記不熟，會列在複習清單</span>
          <button type="button" @click="setMarked(false)">我懂了</button>
        </template>
        <button v-else type="button" @click="setMarked(true)">🔖 標記不熟</button>
      </div>
      <QuestionCard ref="card" :key="current.id" :question="current" @answered="onAnswered" />
      <div v-if="dismissPrompt === 'ask'" ref="dismissEl" class="dismiss" role="group" aria-labelledby="dismiss-text">
        <p id="dismiss-text">{{ DISMISS_PROMPT }}</p>
        <div class="dismiss-actions">
          <button type="button" class="primary" @click="onDismiss">移除</button>
          <button type="button" @click="onKeep">先保留</button>
        </div>
      </div>
      <p v-else-if="dismissPrompt === 'removed'" ref="dismissDoneEl" class="dismiss-done" tabindex="-1">已從錯題本移除。</p>
      <button v-if="index < questions.length - 1" type="button" class="next" @click="index++">下一題 →</button>
    </template>
  </section>
</template>

<style scoped>
h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.dismiss-done:focus {
  outline: none;
}

.empty {
  margin: 0;
  color: #777;
}

.group-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.group {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  min-height: 44px;
  padding: 0.2rem 0.6rem;
  border: 2px solid #d6d0c4;
  border-radius: 10px;
  background: #fff;
  font: inherit;
  cursor: pointer;
}

.group-label {
  font-weight: 700;
}

.group-count {
  font-size: 0.75rem;
  color: #5f5a52;
}

/* 目前這題所在的組 */
.group.current {
  border-color: #4f8cff;
}

/* 正在顯示的組 */
.group.shown {
  background: #2b2633;
  border-color: #2b2633;
  color: #fff;
}

.group.shown .group-count {
  color: #e6e1d8;
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

.mark {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.mark.marked {
  padding: 0.4rem 0.5rem 0.4rem 0.75rem;
  border-radius: 10px;
  background: #fff1c7;
}

.mark-text {
  color: #6b5200;
  font-weight: 600;
}

.mark button {
  min-height: 44px;
  padding: 0 1rem;
  border: 2px solid #c9a227;
  border-radius: 10px;
  background: #fff;
  color: #6b5200;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.dismiss {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border: 2px solid #e8c55a;
  border-radius: 10px;
  background: #fff8e1;
}

.dismiss p {
  margin: 0 0 0.5rem;
  font-weight: 600;
}

.dismiss-actions {
  display: flex;
  gap: 0.5rem;
}

.dismiss-actions button {
  min-height: 44px;
  padding: 0 1rem;
  border: 2px solid #2b2633;
  border-radius: 10px;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.dismiss-actions .primary {
  background: #2b2633;
  color: #fff;
}

.dismiss-done {
  margin: 0.75rem 0 0;
  color: #2a7a38;
  font-weight: 600;
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
