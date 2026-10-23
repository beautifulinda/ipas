<script setup lang="ts">
// 桌面用鍵盤操作時，地圖下方的半透明提示框：說明現在是地圖模式還是作答模式、可以按哪些鍵。
// 只給眼睛看；報讀軟體已經會唸出地圖位置與題目，不重複唸
defineProps<{ answering: boolean }>()
</script>

<template>
  <p class="keyboard-hint" aria-hidden="true">
    <template v-if="answering">作答中：上下鍵選答案・Enter 送出・左右鍵換題・Esc 回地圖</template>
    <template v-else>地圖模式：方向鍵換主題・Enter 作答・Esc 回上一層</template>
  </p>
</template>

<style scoped>
.keyboard-hint {
  position: absolute;
  bottom: 14px;
  left: 50%;
  z-index: 3;
  max-width: calc(100% - 32px);
  margin: 0;
  padding: 0.45rem 1rem;
  border-radius: 999px;
  background: rgba(43, 38, 51, 0.8);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transform: translateX(-50%);
  pointer-events: none;
}
</style>
