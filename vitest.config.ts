import { quickpickle } from 'quickpickle'
import { defineConfig } from 'vitest/config'

// 單元測試只測 utils/ 的純函式，不啟動 Nuxt；~ 對應專案根目錄，與 Nuxt 的別名一致
// tests/features/ 的 .feature 是用中文 Gherkin 寫的需求，由 quickpickle 對應到步驟定義後執行
export default defineConfig({
  // @e2e 的場景要在真的瀏覽器裡操作，由 Playwright 執行（npm run e2e）；在 Vitest 只列為待辦
  plugins: [quickpickle({ todoTags: ['@todo', '@wip', '@e2e'] })],
  resolve: {
    alias: { '~': decodeURIComponent(new URL('.', import.meta.url).pathname) },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/features/**/*.feature'],
    setupFiles: [
      'tests/features/common.steps.ts',
      'tests/features/progression.steps.ts',
      'tests/features/wrongBook.steps.ts',
      'tests/features/wrongBookGroups.steps.ts',
      'tests/features/feedback.steps.ts',
      'tests/features/pastPapers.steps.ts',
      'tests/features/celebration.steps.ts',
      'tests/features/resume.steps.ts',
      'tests/features/questionGroups.steps.ts',
    ],
  },
})
