<script setup lang="ts">
import type { TopicMap } from '~/types/map'
import mapData from '~/data/map.sample.json'

const map = mapData as TopicMap
</script>

<template>
  <main class="page">
    <h1>iPAS AI 應用規劃師（初級）主題地圖</h1>
    <p class="disclaimer">{{ map.disclaimer }}</p>

    <!-- 暫時以清單呈現，確認資料讀得到；地圖在下一步實作 -->
    <section v-for="subject in map.subjects" :key="subject.id">
      <h2>{{ subject.title }}</h2>
      <ul>
        <li v-for="category in subject.categories" :key="category.id">
          {{ category.title }}（{{ category.concepts.length }} 個主題概念）
        </li>
      </ul>
    </section>
  </main>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', sans-serif;
  line-height: 1.6;
}

.page {
  max-width: 48rem;
  margin: 0 auto;
  padding: 1.5rem;
}

.disclaimer {
  color: #555;
  font-size: 0.9rem;
}
</style>
