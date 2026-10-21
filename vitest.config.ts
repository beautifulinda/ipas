import { defineConfig } from 'vitest/config'

// 單元測試只測 utils/ 的純函式，不啟動 Nuxt；~ 對應專案根目錄，與 Nuxt 的別名一致
export default defineConfig({
  resolve: {
    alias: { '~': decodeURIComponent(new URL('.', import.meta.url).pathname) },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
})
