// 〈自己標記不熟的題目，和錯題一起複習〉的 E2E 步驟：標記存進瀏覽器、從複習清單直接打開題目
import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { conceptByTitle, gotoConcept } from './fixture'

const { Given, When, Then } = createBdd()

// 需求背景的主題要和假題庫一致
Given(/^主題「(.+)」有第 1 題和第 2 題$/, async ({ page }, title: string) => {
  expect(conceptByTitle(title).questions).toHaveLength(2)
  await page.goto('./')
})

// 手機要先開全螢幕作答才看得到題目，標記完再關掉
async function markQuestion(page: Page, isMobile: boolean, title: string, n: string) {
  await gotoConcept(page, title)
  if (isMobile) await page.getByRole('button', { name: '開始練習' }).click()
  await page.getByRole('button', { name: new RegExp(`^第 ${n} 題（`) }).click()
  await page.getByRole('button', { name: '🔖 標記不熟' }).click()
  await expect(page.getByRole('button', { name: '我懂了' })).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: '結束練習' }).click()
}

Given(/^第 (\d+) 題已標記不熟$/, async ({ page, isMobile }, n: string) => {
  await markQuestion(page, isMobile, 'AI 治理', n)
})

Given(/^「(.+)」的第 (\d+) 題已標記不熟$/, async ({ page, isMobile }, title: string, n: string) => {
  await markQuestion(page, isMobile, title, n)
})

When('我重新整理網頁', async ({ page }) => {
  await page.reload()
})

// 打開「學習紀錄」選單，找到複習清單裡的那一題
async function reviewItem(page: Page, title: string, n: string) {
  const menu = page.locator('details.records')
  if (!(await menu.getAttribute('open'))) await menu.locator('> summary').click()
  return menu.getByRole('button').filter({ hasText: `測試題：${title} 第 ${n} 題` })
}

Then(/^複習清單裡有第 (\d+) 題，標示「(.+)」$/, async ({ page }, n: string, tag: string) => {
  const item = await reviewItem(page, 'AI 治理', n)
  await expect(item).toBeVisible()
  await expect(item.locator('.tag')).toHaveText([tag])
})

When('我在複習清單點這一題', async ({ page }) => {
  await (await reviewItem(page, 'AI 治理', '2')).click()
})
