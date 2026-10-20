<script setup lang="ts">
import type { TopicMap } from '~/types/map'
import { questionIndex } from '~/utils/concepts'
import { summary, wrongQuestionIds } from '~/utils/progress'

const props = defineProps<{ map: TopicMap }>()
const emit = defineEmits<{ navigate: [conceptId: string] }>()

const { attempts, storageError, exportFile, importFile } = useRecords()
const index = computed(() => questionIndex(props.map))
const stats = computed(() => summary([...attempts.value]))
const wrong = computed(() =>
  wrongQuestionIds([...attempts.value])
    .map((id) => index.value.get(id))
    .filter((item) => item !== undefined),
)

const message = ref('')
const fileInput = ref<HTMLInputElement>()
const menu = ref<HTMLDetailsElement>()

// 從錯題本跳到概念時，順便收起選單，不擋住面板
function goTo(conceptId: string) {
  if (menu.value) menu.value.open = false
  emit('navigate', conceptId)
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
      <span class="long">學習紀錄（錯題 {{ wrong.length }}）</span>
      <span class="short" aria-hidden="true">紀錄・錯題 {{ wrong.length }}</span>
    </summary>
    <div class="records-body">
      <p v-if="storageError" class="warning">{{ storageError }}</p>
      <p class="stats">
        已作答 {{ stats.total }} 次，答對率
        {{ stats.total ? `${Math.round(stats.rate * 100)}%` : '—' }}
      </p>

      <h3>錯題本</h3>
      <p v-if="!wrong.length" class="empty">目前沒有錯題。</p>
      <ul v-else class="wrong-list">
        <li v-for="item in wrong" :key="item.question.id">
          <button type="button" @click="goTo(item.conceptId)">
            <span class="concept">{{ item.conceptTitle }}</span>
            <span class="stem">{{ item.question.stem }}</span>
          </button>
        </li>
      </ul>

      <h3>備份與轉移</h3>
      <p class="hint">紀錄只存在這個瀏覽器，清除瀏覽器資料後會消失，建議定期匯出。</p>
      <div class="actions">
        <button type="button" :disabled="!stats.total" @click="exportFile">匯出 JSON</button>
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
  width: min(360px, 90vw);
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

.concept {
  color: #b23b37;
  font-size: 0.8rem;
  font-weight: 700;
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
</style>
