<script setup lang="ts">
import type { MapNode } from '~/utils/mapTree'

defineProps<{ path: MapNode[] }>()
const emit = defineEmits<{ navigate: [id: string] }>()
</script>

<template>
  <nav class="breadcrumb" aria-label="目前位置">
    <ol>
      <li v-for="(node, index) in path" :key="node.id">
        <span v-if="index === path.length - 1" aria-current="location">{{ node.title }}</span>
        <button v-else type="button" @click="emit('navigate', node.id)">{{ node.title }}</button>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
ol {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

li + li::before {
  content: '›';
  margin-right: 0.25rem;
  color: #888;
}

button {
  padding: 0;
  border: 0;
  background: none;
  color: #1d4ed8;
  font: inherit;
  cursor: pointer;
}

button:hover,
button:focus-visible {
  text-decoration: underline;
}

[aria-current] {
  font-weight: 600;
}
</style>
