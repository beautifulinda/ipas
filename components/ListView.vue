<script setup lang="ts">
import type { TopicMap } from '~/types/map'
import { practiceQuestions } from '~/utils/concepts'
import { latestByQuestion, type Attempt } from '~/utils/progress'

// 清單模式：用一般的巢狀列表瀏覽同樣的三層內容，適合螢幕閱讀器或不想操作地圖時使用
const props = defineProps<{ map: TopicMap; focusId: string; attempts: readonly Attempt[] }>()
const emit = defineEmits<{ navigate: [id: string] }>()

const latest = computed(() => latestByQuestion([...props.attempts]))

function progress(conceptId: string) {
  const concept = props.map.subjects
    .flatMap((s) => s.categories)
    .flatMap((c) => c.concepts)
    .find((c) => c.id === conceptId)
  const questions = concept ? practiceQuestions(concept) : []
  if (!questions.length) return '尚無練習題'
  const correct = questions.filter((q) => latest.value.get(q.id)?.correct).length
  return `答對 ${correct}/${questions.length}`
}
</script>

<template>
  <div class="list-view">
    <section v-for="subject in map.subjects" :key="subject.id" class="subject">
      <h2>
        <button type="button" :aria-current="focusId === subject.id ? 'location' : undefined" @click="emit('navigate', subject.id)">
          {{ subject.title }}
        </button>
      </h2>
      <div v-for="category in subject.categories" :key="category.id" class="category">
        <h3>
          <button
            type="button"
            :aria-current="focusId === category.id ? 'location' : undefined"
            @click="emit('navigate', category.id)"
          >
            {{ category.title }}
          </button>
        </h3>
        <ul v-if="category.concepts.length">
          <li v-for="concept in category.concepts" :key="concept.id">
            <button
              type="button"
              class="concept"
              :aria-current="focusId === concept.id ? 'location' : undefined"
              @click="emit('navigate', concept.id)"
            >
              <span>{{ concept.title }}</span>
              <span class="progress">{{ progress(concept.id) }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="empty">尚無主題概念</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.list-view {
  height: 100%;
  padding: 0.5rem 1.5rem 2rem;
  overflow-y: auto;
  background: #f8f5ee;
  box-sizing: border-box;
}

h2,
h3 {
  margin: 1rem 0 0.25rem;
}

h2 {
  font-size: 1.15rem;
}

h3 {
  font-size: 1rem;
}

button {
  min-height: 44px;
  padding: 0 0.5rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

button:hover,
button:focus-visible {
  background: #ece5d6;
}

button[aria-current] {
  background: #fff1c2;
  outline: 2px solid #2b2633;
}

ul {
  margin: 0;
  padding: 0 0 0 1rem;
  list-style: none;
}

.concept {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  width: 100%;
  max-width: 32rem;
}

.progress {
  color: #64748b;
  font-size: 0.85rem;
}

.empty {
  margin: 0 0 0 1.5rem;
  color: #777;
  font-size: 0.9rem;
}
</style>
