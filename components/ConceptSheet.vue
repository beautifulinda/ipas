<script setup lang="ts">
import type { Concept } from '~/types/map'
import { practiceQuestions } from '~/utils/concepts'
import { latestByQuestion, type Attempt } from '~/utils/progress'

// 手機版：從底部滑出的面板。預設佔下半部，拖曳把手往上展開、往下收起或關閉
const props = defineProps<{ concept: Concept; attempts: readonly Attempt[] }>()
const emit = defineEmits<{ close: []; 'start-quiz': [] }>()

const expanded = ref(false)
const dragY = ref(0)
const dragging = ref(false)
let startY = 0

const questions = computed(() => practiceQuestions(props.concept))
const correctCount = computed(() => {
  const latest = latestByQuestion([...props.attempts])
  return questions.value.filter((q) => latest.get(q.id)?.correct).length
})

watch(
  () => props.concept.id,
  () => {
    expanded.value = false
  },
)

function onPointerDown(event: PointerEvent) {
  dragging.value = true
  startY = event.clientY
  dragY.value = 0
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (dragging.value) dragY.value = event.clientY - startY
}

function onPointerUp() {
  if (!dragging.value) return
  dragging.value = false
  const dy = dragY.value
  dragY.value = 0
  if (Math.abs(dy) < 8) {
    // 點一下把手：展開或收起
    expanded.value = !expanded.value
  } else if (dy > 80) {
    if (expanded.value) expanded.value = false
    else emit('close')
  } else if (dy < -60) {
    expanded.value = true
  }
}
</script>

<template>
  <section
    class="sheet"
    :class="{ expanded, dragging }"
    :style="{ height: `calc(${expanded ? 92 : 50}% - ${dragY}px)` }"
    aria-labelledby="sheet-title"
    data-no-map-keys
  >
    <div
      class="grab"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <span class="handle" aria-hidden="true" />
      <header class="sheet-header">
        <h2 id="sheet-title">{{ concept.title }}</h2>
        <button type="button" class="close" aria-label="關閉" @pointerdown.stop @click="emit('close')">✕</button>
      </header>
    </div>

    <div class="sheet-body">
      <!-- 練習入口放在最前面，面板半開時也看得到 -->
      <div class="practice-entry">
        <p v-if="questions.length">練習題 {{ questions.length }} 題，已答對 {{ correctCount }} 題</p>
        <p v-else>這個主題還沒有練習題。</p>
        <button v-if="questions.length" type="button" class="start" @click="emit('start-quiz')">開始練習</button>
      </div>
      <ConceptSummary :concept="concept" />
      <button type="button" class="toggle" @click="expanded = !expanded">
        {{ expanded ? '收起面板' : '展開面板' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.sheet {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  max-height: 100%;
  border-top: 3px solid #2b2633;
  border-radius: 18px 18px 0 0;
  background: #fffaf0;
  box-shadow: 0 -6px 16px rgba(0, 0, 0, 0.15);
  transition: height 0.25s ease;
}

.sheet.dragging {
  transition: none;
}

/* 把手與標題列可以拖曳；關掉瀏覽器的捲動手勢，拖曳才不會被搶走 */
.grab {
  flex: none;
  padding: 0.4rem 1rem 0.25rem;
  touch-action: none;
  cursor: grab;
}

.handle {
  display: block;
  width: 44px;
  height: 5px;
  margin: 0 auto 0.4rem;
  border-radius: 999px;
  background: #b9b3a8;
}

.sheet-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
}

h2 {
  margin: 0;
  font-size: 1.2rem;
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

.sheet-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.25rem 1rem 1.25rem;
  overflow-y: auto;
}

.practice-entry {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.practice-entry p {
  margin: 0;
  font-weight: 700;
}

.start {
  flex: none;
  min-height: 44px;
  padding: 0 1.25rem;
  border: 0;
  border-radius: 10px;
  background: #2b2633;
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.toggle {
  align-self: center;
  min-height: 44px;
  padding: 0 1rem;
  border: 0;
  background: transparent;
  color: #64748b;
  font: inherit;
  cursor: pointer;
}
</style>
