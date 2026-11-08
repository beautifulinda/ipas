// 〈梯次入口（題庫沒有考古題時）〉的 E2E 步驟：E2E 的假題庫只有自編題
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { concepts, conceptId } from './fixture'

const { Given, When, Then } = createBdd()

Given('題庫沒有考古題，只有自編題', async () => {
  expect(concepts.flatMap((c) => c.questions).filter((q) => q.source.type === 'official-past')).toHaveLength(0)
})

When(/^我用網址打開主題「(.+)」（網址有 \?at=）$/, async ({ page }, title: string) => {
  await page.goto(`./?at=${conceptId(title)}`)
})

Then(/^不顯示梯次入口，直接進地圖、打開「(.+)」$/, async ({ page }, title: string) => {
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
  await expect(page.getByRole('heading', { name: '選一份考古題開始' })).toHaveCount(0)
})

// 舊連結掛載後補上 paper=all，回到最上層時才不會跳回入口
Then('地圖顯示全部梯次的題目', async ({ page }) => {
  await expect(page).toHaveURL(/[?&]paper=all(&|$)/)
  await expect(page.getByText(/^目前：/)).toHaveCount(0)
})

When('我打開網站', async ({ page }) => {
  await page.goto('./')
})

Then(/^入口顯示「(.+)」$/, async ({ page }, text: string) => {
  await expect(page.locator('.entry').getByText(text, { exact: true })).toBeVisible()
})

Then(/^只有「(.+)」可以點$/, async ({ page }, name: string) => {
  const entry = page.locator('.entry')
  await expect(entry.getByRole('button', { name })).toBeEnabled()
  await expect(entry.locator('button:enabled')).toHaveCount(1)
})
