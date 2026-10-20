<script setup lang="ts">
import type { Concept } from '~/types/map'

defineProps<{ concept: Concept }>()
</script>

<template>
  <section class="card">
    <p class="summary">{{ concept.summary }}</p>
    <ul v-if="concept.keyPoints.length" class="key-points">
      <li v-for="point in concept.keyPoints" :key="point">{{ point }}</li>
    </ul>
  </section>
</template>

<style scoped>
.card {
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 0 rgba(43, 38, 51, 0.15);
}

.summary {
  margin: 0;
}

.key-points {
  margin: 0.5rem 0 0;
  padding-left: 1.2rem;
}
</style>
