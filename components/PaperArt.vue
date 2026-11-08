<script setup lang="ts">
// 梯次入口的科目插畫：第一科多考傳統 AI（資料分類、機器學習），畫散佈圖與分類邊界；
// 第二科多考大語言模型與 Agent 應用，畫對話泡泡和拿著工具的機器人
defineProps<{ paper: 1 | 2 }>()
</script>

<template>
  <svg class="paper-art" viewBox="0 0 80 80" aria-hidden="true" focusable="false">
    <g v-if="paper === 1" stroke="#2b2633" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 12 V66 H70" fill="none" stroke-width="3" />
      <path d="M20 60 C34 52 44 30 66 18" fill="none" stroke-width="2.5" stroke-dasharray="5 4" />
      <circle cx="25" cy="24" r="4.5" fill="#4f8cff" stroke-width="2" />
      <circle cx="35" cy="18" r="4.5" fill="#4f8cff" stroke-width="2" />
      <circle cx="23" cy="40" r="4.5" fill="#4f8cff" stroke-width="2" />
      <circle cx="36" cy="31" r="4.5" fill="#4f8cff" stroke-width="2" />
      <rect x="46" y="48" width="9" height="9" rx="1.5" fill="#f39c3d" stroke-width="2" />
      <rect x="57" y="36" width="9" height="9" rx="1.5" fill="#f39c3d" stroke-width="2" />
      <rect x="58" y="52" width="9" height="9" rx="1.5" fill="#f39c3d" stroke-width="2" />
      <rect x="44" y="34" width="9" height="9" rx="1.5" fill="#f39c3d" stroke-width="2" />
    </g>
    <g v-else stroke="#2b2633" stroke-linecap="round" stroke-linejoin="round">
      <path
        d="M14 6 H34 a8 8 0 0 1 8 8 V22 a8 8 0 0 1 -8 8 H24 L14 38 L16 30 H14 a8 8 0 0 1 -8 -8 V14 a8 8 0 0 1 8 -8 Z"
        fill="#fff"
        stroke-width="2.5"
      />
      <circle cx="16" cy="18" r="2.2" fill="#2b2633" stroke="none" />
      <circle cx="24" cy="18" r="2.2" fill="#2b2633" stroke="none" />
      <circle cx="32" cy="18" r="2.2" fill="#2b2633" stroke="none" />
      <path d="M51 33 V25" stroke-width="2.5" />
      <circle cx="51" cy="21" r="3.5" fill="#f39c3d" stroke-width="2" />
      <rect x="26" y="43" width="5" height="12" rx="2" fill="#f39c3d" stroke-width="2" />
      <rect x="71" y="43" width="5" height="12" rx="2" fill="#f39c3d" stroke-width="2" />
      <rect x="30" y="33" width="42" height="34" rx="10" fill="#ffd9a8" stroke-width="3" />
      <circle cx="43" cy="48" r="4" fill="#2b2633" stroke="none" />
      <circle cx="59" cy="48" r="4" fill="#2b2633" stroke="none" />
      <path d="M44 57 Q51 62 58 57" fill="none" stroke-width="2.5" />
      <circle cx="16" cy="64" r="10" fill="#fff" stroke-width="2.5" />
      <path d="M11 69 L18 62" stroke-width="3.5" />
      <circle cx="19.5" cy="60.5" r="3.5" fill="#fff" stroke-width="2.5" />
    </g>
  </svg>
</template>
