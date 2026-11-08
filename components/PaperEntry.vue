<script setup lang="ts">
import {
  ENTRY_ALL_TEXT,
  NO_PAST_PAPERS,
  PAPER_MISSING,
  cellLabel,
  cellText,
  paperParam,
  type EntryRow,
  type PaperChoice,
} from '~/utils/paperEntry'
import { paperName } from '~/utils/pastPapers'

// 梯次入口（需求在 tests/features/梯次入口.feature）：每次打開網站先列出每一次考試，左邊第一科、右邊第二科
// 進場、離場的轉場在 utils/entryTransition.ts（GSAP），由首頁的 <Transition> 呼叫
const props = defineProps<{ rows: EntryRow[]; ready: boolean }>()
const emit = defineEmits<{ choose: [choice: PaperChoice]; all: [] }>()

const rootEl = ref<HTMLElement>()

// 從地圖回來時焦點移到第一份考卷，報讀軟體從列表開始唸
function focusFirst() {
  rootEl.value?.querySelector<HTMLButtonElement>('.cell:not(:disabled), .all')?.focus()
}

defineExpose({ focusFirst })
</script>

<template>
  <section ref="rootEl" class="entry" aria-labelledby="entry-title">
    <div class="inner">
      <header class="intro">
        <h2 id="entry-title">選一份考古題開始</h2>
        <p>每一次考試分成第一科、第二科，點一份就到那一科的島，只練這一份的題目。</p>
      </header>

      <p v-if="!props.rows.length" class="empty">{{ NO_PAST_PAPERS }}</p>

      <ol v-else class="rows">
        <li v-for="row in props.rows" :key="row.session" class="row">
          <h3 class="session">{{ row.title }}</h3>
          <div class="cells">
            <template v-for="(cell, i) in row.papers" :key="i">
              <button
                v-if="cell"
                type="button"
                class="cell"
                :class="`cell--${i + 1}`"
                :data-paper="paperParam(cell.paper)"
                :aria-label="cellLabel(cell)"
                @click="emit('choose', { session: cell.paper.session, paper: cell.paper.paper })"
              >
                <span class="text">
                  <span class="paper-name">{{ paperName(i + 1) }}</span>
                  <span class="status">{{ props.ready ? cellText(cell) : '　' }}</span>
                </span>
                <span class="art"><PaperArt :paper="i === 0 ? 1 : 2" /></span>
                <span v-if="props.ready && cell.answered" class="bar" aria-hidden="true">
                  <span class="bar-correct" :style="{ width: `${(cell.correct / cell.total) * 100}%` }" />
                  <span class="bar-wrong" :style="{ width: `${((cell.answered - cell.correct) / cell.total) * 100}%` }" />
                </span>
              </button>
              <button v-else type="button" class="cell cell--missing" disabled>
                <span class="text">
                  <span class="paper-name">{{ paperName(i + 1) }}</span>
                  <span class="status">{{ PAPER_MISSING }}</span>
                </span>
                <span class="art"><PaperArt :paper="i === 0 ? 1 : 2" /></span>
              </button>
            </template>
          </div>
        </li>
      </ol>

      <button type="button" class="all" @click="emit('all')">{{ ENTRY_ALL_TEXT }}</button>
    </div>
  </section>
</template>

<style scoped>
.entry {
  position: fixed;
  inset: 0;
  z-index: 20;
  overflow-y: auto;
  background: #fffaf0;
}

.inner {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 760px;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;
}

.intro h2 {
  margin: 0;
  font-size: 1.5rem;
}

.intro p {
  margin: 0.25rem 0 0;
  color: #555;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.session {
  margin: 0 0 0.4rem;
  font-size: 1.05rem;
}

/* 左邊第一科、右邊第二科；手機也維持左右兩欄 */
.cells {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

/* 文字在左、科目插畫在右，進度條橫跨整格 */
.cell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 0.6rem;
  align-items: center;
  min-height: 88px;
  padding: 0.75rem 0.9rem;
  border: 3px solid #2b2633;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 4px 0 #2b2633;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
}

.cell--1 {
  background: #eef6ff;
}

.cell--2 {
  background: #fff3e6;
}

.cell:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 0 #2b2633;
}

.text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

/* 插畫框固定大小，滑鼠移過去（或鍵盤移到）時圖在框裡放大 */
.art {
  display: block;
  width: 84px;
  height: 84px;
  overflow: hidden;
  border: 2px solid #2b2633;
  border-radius: 12px;
  background: #fff;
}

.cell--1 .art {
  background: #dcebff;
}

.cell--2 .art {
  background: #ffe6c7;
}

.paper-art {
  display: block;
  width: 100%;
  height: 100%;
  transition: transform 0.3s ease;
}

.cell:hover:not(:disabled) .paper-art,
.cell:focus-visible .paper-art {
  transform: scale(1.25) rotate(-3deg);
}

.cell:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0 2px 0 #2b2633;
}

.cell:focus-visible,
.all:focus-visible {
  outline: 3px solid #4f8cff;
  outline-offset: 3px;
}

.cell--missing {
  border-style: dashed;
  background: #f4f1ea;
  box-shadow: none;
  color: #6b6470;
  cursor: not-allowed;
}

.cell--missing .art {
  background: #ece8df;
  filter: grayscale(1);
  opacity: 0.5;
}

.paper-name {
  font-size: 1.15rem;
  font-weight: 800;
}

.status {
  font-size: 0.9rem;
}

/* 進度條：答對綠色、答錯紅色斜線（和地圖上的進度圓餅一致，紅綠色弱也分得出來） */
.bar {
  display: flex;
  grid-column: 1 / -1;
  width: 100%;
  height: 8px;
  margin-top: 0.3rem;
  overflow: hidden;
  border: 1.5px solid #2b2633;
  border-radius: 999px;
  background: #e5e1d8;
}

.bar-correct {
  background: #3f9d4d;
}

.bar-wrong {
  background: repeating-linear-gradient(45deg, #d9534f 0 3px, #f2b8b5 3px 6px);
}

.empty {
  margin: 0;
  padding: 1rem;
  border: 3px dashed #2b2633;
  border-radius: 14px;
  text-align: center;
}

.all {
  align-self: center;
  min-height: 44px;
  padding: 0 1.2rem;
  border: 2px solid #2b2633;
  border-radius: 999px;
  background: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 520px) {
  .inner {
    padding: 1.25rem 0.9rem 2rem;
  }

  .cell {
    min-height: 80px;
    padding: 0.6rem 0.7rem;
  }

  .status {
    font-size: 0.8rem;
  }

  .art {
    width: 44px;
    height: 44px;
    border-radius: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .paper-art {
    transition: none;
  }

  .cell:hover:not(:disabled) .paper-art,
  .cell:focus-visible .paper-art {
    transform: none;
  }
}
</style>
