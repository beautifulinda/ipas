<script setup lang="ts">
import type { TopicMap } from '~/types/map'
import mapData from '~/data/map.sample.json'
import { ROOT_ID, findPath, toMapTree } from '~/utils/mapTree'

const map = mapData as TopicMap
const tree = toMapTree(map)

const focusId = ref(ROOT_ID)
const path = computed(() => findPath(tree, focusId.value))
</script>

<template>
  <div class="layout">
    <header class="header">
      <h1>iPAS AI 應用規劃師（初級）主題地圖</h1>
      <p class="disclaimer">{{ map.disclaimer }}</p>
      <MapBreadcrumb :path="path" @navigate="focusId = $event" />
    </header>

    <main class="map-area">
      <TopicMap v-model:focus-id="focusId" :tree="tree" />
    </main>

    <footer class="hint">點擊節點放大・滾輪縮放・拖曳平移・Esc 返回上一層・方向鍵切換同層</footer>
  </div>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', sans-serif;
  line-height: 1.6;
  color: #1e293b;
}

.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
}

.header {
  padding: 1rem 1.5rem 0.5rem;
}

.header h1 {
  margin: 0;
  font-size: 1.4rem;
}

.disclaimer {
  margin: 0.25rem 0 0.75rem;
  color: #555;
  font-size: 0.85rem;
}

.map-area {
  flex: 1;
  min-height: 0;
  background: #f8fafc;
}

.hint {
  padding: 0.5rem 1.5rem;
  color: #64748b;
  font-size: 0.8rem;
}
</style>
