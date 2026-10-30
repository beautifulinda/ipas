<script setup lang="ts">
import type { TopicMap } from '~/types/map'
import { questionIndex } from '~/utils/concepts'
import { knownAttempts, removedNotice, removedQuestionIds, summary } from '~/utils/progress'
import { reviewList } from '~/utils/progress'
import {
  filterItems,
  filterLabels,
  groupEmptyText,
  groupScoreLabel,
  itemTags,
  recordMenuLabel,
  subjectTabLabel,
  wrongBookBySubject,
  type ReviewFilter,
} from '~/utils/wrongBook'

const props = defineProps<{ map: TopicMap }>()
// navigate：點複習清單的題目，前往主題並直接打開那一題
const emit = defineEmits<{ navigate: [conceptId: string, questionId: string] }>()

const { attempts, wrongQuestionIds, markedQuestionIds, storageError, exportFile, importFile } = useRecords()
const { soundOn, setSoundOn } = useSound()
const index = computed(() => questionIndex(props.map))
const knownIds = computed(() => new Set(index.value.keys()))
// 已下架題目的作答紀錄保留在瀏覽器（重新上架時接得回來），但不算進統計
const stats = computed(() => summary(knownAttempts(attempts.value, knownIds.value)))
const removed = computed(() => removedQuestionIds(attempts.value, knownIds.value).length)
// 已下架的題目不列在複習清單
const wrong = computed(() => wrongQuestionIds.value.filter((id) => index.value.has(id)))
const marked = computed(() => markedQuestionIds.value.filter((id) => index.value.has(id)))
const reviewCount = computed(() => reviewList(wrong.value, marked.value).length)
// 複習清單（錯題加上自己標記不熟的題目，需求在 tests/features/標記不熟.feature）：L11、L12 分開考，分科目看；
// 考古題再依梯次分開，看這次錯幾題／50
const subjects = computed(() =>
  wrongBookBySubject(
    props.map,
    wrong.value,
    new Set(knownAttempts(attempts.value, knownIds.value).map((a) => a.questionId)),
    marked.value,
  ),
)
const subjectId = ref<string>()
const currentSubject = computed(
  () => subjects.value.find((s) => s.id === subjectId.value) ?? subjects.value.find((s) => s.reviewCount) ?? subjects.value[0],
)
const filter = ref<ReviewFilter>('all')
const filters: ReviewFilter[] = ['all', 'wrong', 'marked']

const message = ref('')
const fileInput = ref<HTMLInputElement>()
const menu = ref<HTMLDetailsElement>()

// 從複習清單跳到題目時，順便收起選單，不擋住面板
function goTo(conceptId: string, questionId: string) {
  if (menu.value) menu.value.open = false
  emit('navigate', conceptId, questionId)
}

async function onImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const count = await importFile(file)
    message.value = count ? `已匯入 ${count} 筆紀錄。` : '沒有新的紀錄（都已存在）。'
  } catch (error) {
    message.value = error instanceof Error ? error.message : '匯入失敗。'
  }
}
</script>

<template>
  <details ref="menu" class="records">
    <summary>
      <span class="long">{{ recordMenuLabel(reviewCount) }}</span>
      <span class="short" aria-hidden="true">紀錄・複習 {{ reviewCount }}</span>
    </summary>
    <div class="records-body">
      <p v-if="storageError" class="warning">{{ storageError }}</p>
      <p class="stats">
        已作答 {{ stats.total }} 次，答對率
        {{ stats.total ? `${Math.round(stats.rate * 100)}%` : '—' }}
      </p>
      <p v-if="removed" class="hint">{{ removedNotice(removed) }}</p>

      <h3>複習清單</h3>
      <div class="subject-tabs" role="group" aria-label="科目">
        <button
          v-for="subject in subjects"
          :key="subject.id"
          type="button"
          :aria-pressed="subject.id === currentSubject?.id"
          @click="subjectId = subject.id"
        >
          {{ subjectTabLabel(subject) }}
        </button>
      </div>
      <template v-if="currentSubject">
        <div class="filters" role="group" aria-label="篩選">
          <button
            v-for="key in filters"
            :key="key"
            type="button"
            :aria-pressed="filter === key"
            @click="filter = key"
          >
            {{ filterLabels(currentSubject)[key] }}
          </button>
        </div>
        <p v-if="!currentSubject.groups.length" class="empty">{{ currentSubject.title }}目前沒有題目。</p>
        <details
          v-for="group in currentSubject.groups"
          :key="group.key"
          class="paper"
          :open="filterItems(group.items, filter).length > 0 && filterItems(group.items, filter).length <= 5"
        >
          <summary>
            <span class="paper-title">{{ group.title }}</span>
            <span class="paper-score">{{ groupScoreLabel(group) }}</span>
          </summary>
          <p v-if="!filterItems(group.items, filter).length" class="empty">{{ groupEmptyText(group) }}</p>
          <ul v-else class="wrong-list">
            <li v-for="item in filterItems(group.items, filter)" :key="item.question.id">
              <button type="button" @click="goTo(item.conceptId, item.question.id)">
                <span class="concept">
                  {{ item.number ? `第 ${item.number} 題・` : '' }}{{ item.conceptTitle }}
                  <span v-for="tag in itemTags(item)" :key="tag" class="tag" :class="tag === '答錯' ? 'tag-wrong' : 'tag-marked'">{{ tag }}</span>
                </span>
                <span class="stem">{{ item.question.stem }}</span>
              </button>
            </li>
          </ul>
        </details>
      </template>

      <h3>升級音效</h3>
      <button
        type="button"
        class="switch"
        role="switch"
        :aria-checked="soundOn"
        @click="setSoundOn(!soundOn)"
      >
        <span class="knob" aria-hidden="true" />
        {{ soundOn ? '開：城鎮升級時播放音效' : '關：升級時不出聲' }}
      </button>

      <h3>備份與轉移</h3>
      <p class="hint">紀錄只存在這個瀏覽器，清除瀏覽器資料後會消失，建議定期匯出。</p>
      <div class="actions">
        <button type="button" :disabled="!attempts.length" @click="exportFile">匯出 JSON</button>
        <button type="button" @click="fileInput?.click()">匯入 JSON</button>
        <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onImport" />
      </div>
      <p v-if="message" class="message" role="status">{{ message }}</p>
    </div>
  </details>
</template>

<style scoped>
.records {
  position: relative;
  flex: none;
}

.short {
  display: none;
}

/* 窄螢幕改用短標題，按鈕不會被擠成兩三行 */
@media (max-width: 480px) {
  .long {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .short {
    display: inline;
  }
}

summary {
  min-height: 44px;
  padding: 0 1rem;
  border: 2px solid #2b2633;
  border-radius: 999px;
  background: #fff7dc;
  font-weight: 700;
  line-height: 40px;
  cursor: pointer;
  list-style: none;
  white-space: nowrap;
  box-sizing: border-box;
}

summary::-webkit-details-marker {
  display: none;
}

.records-body {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 10;
  width: min(420px, 90vw);
  max-height: 70vh;
  padding: 1rem;
  overflow-y: auto;
  border: 2px solid #2b2633;
  border-radius: 14px;
  background: #fffdf6;
  box-shadow: 0 6px 0 rgba(43, 38, 51, 0.2);
  box-sizing: border-box;
}

h3 {
  margin: 1rem 0 0.4rem;
  font-size: 0.95rem;
}

p {
  margin: 0;
}

.stats {
  font-weight: 700;
}

.warning {
  margin-bottom: 0.5rem;
  color: #b23b37;
}

.empty,
.hint {
  color: #777;
  font-size: 0.85rem;
}

.subject-tabs {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.subject-tabs button {
  flex: 1;
  min-height: 44px;
  border: 2px solid #2b2633;
  border-radius: 10px;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.subject-tabs button[aria-pressed='true'] {
  background: #2b2633;
  color: #fff;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.filters button {
  min-height: 44px;
  padding: 0 0.9rem;
  border: 2px solid #d6d0c4;
  border-radius: 999px;
  background: #fff;
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}

.filters button[aria-pressed='true'] {
  border-color: #2b2633;
  background: #f3ecdc;
  font-weight: 700;
}

.paper {
  border-bottom: 1px solid #ece4d2;
}

.paper > summary {
  display: grid;
  min-height: 44px;
  padding: 0.4rem 0.25rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-weight: 400;
  line-height: 1.4;
  white-space: normal;
}

.paper > summary:hover,
.paper > summary:focus-visible {
  background: #f3ecdc;
}

.paper-title {
  font-weight: 700;
}

.paper-title::before {
  display: inline-block;
  width: 1.1em;
  color: #8a7f6c;
  content: '▶';
  font-size: 0.75em;
  transition: transform 0.15s;
}

.paper[open] .paper-title::before {
  transform: rotate(90deg);
}

.paper-score {
  padding-left: 1em;
  color: #556274;
  font-size: 0.85rem;
}

.paper > .empty {
  padding: 0 0.25rem 0.5rem 1.25rem;
}

.wrong-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.wrong-list button {
  display: grid;
  width: 100%;
  min-height: 44px;
  padding: 0.4rem 0.5rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.wrong-list button:hover,
.wrong-list button:focus-visible {
  background: #f3ecdc;
}

/* 答錯或不熟由旁邊的標示表達，主題名稱用中性色 */
.concept {
  color: #4a453d;
  font-size: 0.8rem;
  font-weight: 700;
}

.tag {
  display: inline-block;
  margin-left: 0.3rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.tag-wrong {
  background: #fbe3e2;
  color: #a1322e;
}

.tag-marked {
  background: #fff1c7;
  color: #6b5200;
}

.stem {
  overflow: hidden;
  font-size: 0.9rem;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.actions button {
  min-height: 44px;
  padding: 0 1rem;
  border: 2px solid #2b2633;
  border-radius: 10px;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.message {
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.switch {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 44px;
  padding: 0 0.9rem 0 0.4rem;
  border: 2px solid #2b2633;
  border-radius: 999px;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.knob {
  position: relative;
  width: 40px;
  height: 24px;
  border-radius: 999px;
  background: #d8d0c0;
  transition: background 0.2s;
}

.knob::after {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  content: '';
  transition: transform 0.2s;
}

.switch[aria-checked='true'] .knob {
  background: #2f8a4f;
}

.switch[aria-checked='true'] .knob::after {
  transform: translateX(16px);
}

@media (prefers-reduced-motion: reduce) {
  .knob,
  .knob::after {
    transition: none;
  }
}
</style>
