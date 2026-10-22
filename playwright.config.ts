/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

// E2E：在真的瀏覽器裡跑 tests/features/ 標了 @e2e 的場景，網站用假題庫建置（npm run e2e:build）
// 同一份需求檔的其他場景由 Vitest 執行
const testDir = defineBddConfig({
  features: 'tests/features/*.feature',
  steps: 'tests/e2e/*.steps.ts',
  tags: '@e2e',
})

const PORT = 4174

export default defineConfig({
  testDir,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/ipas/`,
    // 關掉鏡頭飛行與標籤上下跳動，點擊時位置才穩定
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // 桌面、Android（Chromium）、iPhone（WebKit）各跑一次；手機會模擬觸控（pointer: coarse）
  projects: [
    { name: '桌面', use: { ...devices['Desktop Chrome'] } },
    { name: 'Android', use: { ...devices['Pixel 7'] } },
    { name: 'iPhone', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: `npx serve -l ${PORT} --no-clipboard .output-e2e/site`,
    url: `http://localhost:${PORT}/ipas/`,
    reuseExistingServer: !process.env.CI,
  },
})
