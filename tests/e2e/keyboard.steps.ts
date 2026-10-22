// 〈用鍵盤在地圖上選主題並作答〉的 E2E 步驟：地圖模式與作答模式之間的按鍵操作
import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { concepts, conceptId, currentQuestion, gotoConcept, regionIdOf } from './fixture'

const { Given, When, Then } = createBdd()

const map = (page: Page) => page.locator('.map3d')
const options = (page: Page) => page.getByRole('radiogroup', { name: '選項' })
const panelTitle = (page: Page) => page.locator('aside h2')
const KEYS: Record<string, string> = { 上: 'ArrowUp', 下: 'ArrowDown', 左: 'ArrowLeft', 右: 'ArrowRight' }

// 焦點在地圖（不在面板裡）時，方向鍵才會換主題
async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
}

async function expectQuestion(page: Page, n: string) {
  await expect(page.locator('.practice .stem')).toHaveText(new RegExp(` 第 ${n} 題$`))
}

// 先前往同一層的第一個主題，再用方向鍵往右切換，直到選到指定的主題
Given(/^我用方向鍵在地圖上選到「(.+)」$/, async ({ page }, title: string) => {
  if (!(await panelTitle(page).isVisible())) await gotoConcept(page, concepts[0].title)
  await blur(page)
  for (let i = 0; i < concepts.length && (await panelTitle(page).textContent()) !== title; i++) {
    await page.keyboard.press('ArrowRight')
    await expect(page).toHaveURL(/[?&]at=/)
  }
  await expect(panelTitle(page)).toHaveText(title)
})

// 透過畫面作答（滑鼠），再重新打開主題回到地圖模式，模擬「之前練習過」
async function answeredBefore(page: Page, title: string, n: string, correct: boolean) {
  await page.getByRole('button', { name: new RegExp(`^第 ${n} 題（`) }).click()
  const question = await currentQuestion(page)
  const option = question.options.find((o) => (o.id === question.answer) === correct)!
  await options(page).getByRole('radio', { name: `${option.id} ${option.text}` }).click()
  await page.getByRole('button', { name: '送出答案' }).click()
  await expect(page.locator('.feedback')).toBeVisible()
  await gotoConcept(page, title)
  await expect(panelTitle(page)).toHaveText(title)
  // 等作答紀錄載入完（題號標出答對／答錯）再繼續操作
  await expect(page.getByRole('button', { name: new RegExp(`^第 ${n} 題（答[對錯]）`) })).toBeVisible()
}

Given(/^我已經作答過「(.+)」的第 (\d+) 題$/, async ({ page }, title: string, n: string) => {
  await answeredBefore(page, title, n, true)
})

Given(/^我答錯過「(.+)」的第 (\d+) 題$/, async ({ page }, title: string, n: string) => {
  await answeredBefore(page, title, n, false)
})

When(/^我(?:再)?按 Enter$/, async ({ page }) => {
  await page.keyboard.press('Enter')
})

When('我連按兩次 Enter', async ({ page }) => {
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
})

When('我還沒選答案就按 Enter', async ({ page }) => {
  await page.keyboard.press('Enter')
})

When('我按 Esc', async ({ page }) => {
  await page.keyboard.press('Escape')
})

When('我按 Esc 兩次', async ({ page }) => {
  await page.keyboard.press('Escape')
  await expect(map(page)).toHaveAttribute('data-mode', 'map')
  await page.keyboard.press('Escape')
})

When(/^我按(上|下|左|右)鍵$/, async ({ page }, key: string) => {
  await page.keyboard.press(KEYS[key])
})

Given('我按 Enter 進入作答', async ({ page }) => {
  await page.keyboard.press('Enter')
  await expect(page.locator(':focus')).toHaveAttribute('role', 'radio')
})

// 每題都用鍵盤選第一個選項（假題庫的正確答案）並送出，還有下一題要答時按 Enter 前往
Given(/^我按 Enter 進入作答，並答完第 (.+) 題$/, async ({ page }, list: string) => {
  const numbers = list.split('、')
  await page.keyboard.press('Enter')
  for (const [i, n] of numbers.entries()) {
    await expectQuestion(page, n)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page.locator('.feedback')).toBeFocused()
    if (i < numbers.length - 1) await page.keyboard.press('Enter')
  }
})

Then(/^鍵盤停在第 (\d+) 題的選項上$/, async ({ page }, n: string) => {
  await expectQuestion(page, n)
  await expect(options(page).locator(':focus')).toHaveAttribute('role', 'radio')
})

Then(/^我按左鍵後回到第 (\d+) 題$/, async ({ page }, n: string) => {
  await page.keyboard.press('ArrowLeft')
  await expectQuestion(page, n)
  await expect(options(page).locator(':focus')).toHaveAttribute('role', 'radio')
})

Then(/^地圖放大到「(.+)」的建築物$/, async ({ page }, title: string) => {
  await expect(map(page)).toHaveAttribute('data-view', `town:${conceptId(title)}`)
})

Then(/^地圖縮回原本看「(.+)」的畫面$/, async ({ page }, title: string) => {
  await expect(map(page)).toHaveAttribute('data-view', conceptId(title))
})

Then(/^建築物上方顯示「(.+)」$/, async ({ page }, text: string) => {
  await expect(page.locator('.tag--answering')).toHaveText(text)
})

Then('「作答中」的提示消失', async ({ page }) => {
  await expect(page.locator('.tag--answering')).toHaveCount(0)
})

Then('還在地圖模式', async ({ page }) => {
  await expect(map(page)).toHaveAttribute('data-mode', 'map')
})

Then('這題還沒有作答紀錄', async ({ page }) => {
  await expect(page.locator('.question-nav [aria-current="step"]')).toHaveAccessibleName(/未作答/)
})

Then(/^畫面顯示「(.+)」$/, async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: true })).toBeVisible()
})

When(/^我按(上|下)鍵選到「(.+)」$/, async ({ page }, key: string, name: string) => {
  await page.keyboard.press(KEYS[key])
  await expect(options(page).getByRole('radio', { name, checked: true })).toBeFocused()
})

Then(/^選的還是「(.+)」$/, async ({ page }, name: string) => {
  await expect(options(page).getByRole('radio', { name, checked: true })).toBeFocused()
})

Then(/^還停在第 (\d+) 題的作答結果$/, async ({ page }, n: string) => {
  await expectQuestion(page, n)
  await expect(page.locator('.feedback')).toBeFocused()
})

Then(/^鍵盤停在「(.+)」$/, async ({ page }, text: string) => {
  const prompt = page.getByRole('group', { name: text })
  await expect(prompt).toBeVisible()
  await expect(prompt.locator(':focus')).toHaveCount(1)
})

When(/^我按左右鍵選到「(.+)」並按 Enter$/, async ({ page }, name: string) => {
  const buttons = page.locator('.dismiss button')
  const first = (await buttons.first().textContent()) === name
  await page.keyboard.press(first ? 'ArrowLeft' : 'ArrowRight')
  await expect(page.getByRole('button', { name, exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
})

Then(/^回到地圖模式，還停在「(.+)」，面板沒有關$/, async ({ page }, title: string) => {
  await expect(map(page)).toHaveAttribute('data-mode', 'map')
  await expect(page).toHaveURL(new RegExp(`[?&]at=${conceptId(title)}(&|$)`))
  await expect(panelTitle(page)).toHaveText(title)
})

Then(/^地圖回到「(.+)」所在的地區$/, async ({ page }, title: string) => {
  await expect(page).toHaveURL(new RegExp(`[?&]at=${regionIdOf(title)}(&|$)`))
})

// 地圖是 3D 畫面，用城鎮標籤記下的畫面位置點下去
When(/^我用滑鼠點地圖上的「(.+)」$/, async ({ page }, title: string) => {
  const label = page.locator('.tag--town').filter({ hasText: title })
  const [x, y] = await label.evaluate((el: HTMLElement) => [Number(el.dataset.x), Number(el.dataset.y)])
  const box = (await page.locator('.map3d canvas').boundingBox())!
  expect(x > 0 && x < box.width && y > 0 && y < box.height, `「${title}」不在畫面上`).toBe(true)
  await page.mouse.click(box.x + x, box.y + y - 6)
})

When(/^我用滑鼠點「(.+)」$/, async ({ page }, name: string) => {
  await options(page).getByRole('radio', { name }).click()
})
