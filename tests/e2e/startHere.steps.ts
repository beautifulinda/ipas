// 「從這裡開始」的 E2E 步驟：在真的瀏覽器裡點 3D 地圖上的標記
import { expect } from '@playwright/test'
import { createBdd, type DataTable } from 'playwright-bdd'
import { conceptId, concepts } from './fixture'

const { Given, When, Then } = createBdd()

// 網站用 tests/e2e/fixtures/map.json 建置；需求裡的主題表格必須和假題庫一致，否則測的不是需求描述的情況
Given('地圖上依官方順序有三個主題：', async ({ page }, table: DataTable) => {
  const rows = table.hashes() as { 主題: string; 題數: string }[]
  expect(concepts.map((c) => ({ 主題: c.title, 題數: String(c.questions.length) }))).toEqual(rows)
  await page.goto('./')
})

When('我點地圖上的「從這裡開始」', async ({ page }) => {
  // 只點畫在地圖上的標記；螢幕閱讀器用的導覽按鈕文字是「從這裡開始：主題名稱」，不會被選到
  await page.getByText('從這裡開始', { exact: true }).click()
})

Then(/^地圖前往「(.+)」$/, async ({ page }, title: string) => {
  await expect(page).toHaveURL(new RegExp(`[?&]at=${conceptId(title)}(&|$)`))
  await expect(page.getByRole('navigation', { name: '目前位置' }).locator('[aria-current="location"]')).toHaveText(title)
})

// 手機開全螢幕作答，桌面捲到右側面板的練習題；兩種都要看得到題目本身
Then(/^畫面直接顯示「(.+)」的第 (\d+) 題$/, async ({ page, isMobile }, title: string, n: string) => {
  const stem = page.getByText(`測試題：${title} 第 ${n} 題`, { exact: true })
  if (isMobile) await expect(page.getByRole('dialog', { name: `${title}・練習` })).toBeVisible()
  await expect(stem).toBeInViewport()
})
