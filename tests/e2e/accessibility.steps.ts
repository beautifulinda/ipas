// 〈看不到畫面也能練習〉的 E2E 步驟：用鍵盤操作，檢查焦點停在哪裡、背景是否 inert、文字對比
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { currentQuestion, gotoConcept } from './fixture'

const { Given, When, Then, Before } = createBdd()

// 焦點的行為桌面（右側面板）和手機（全螢幕作答）不同，用標籤只在適用的裝置跑
Before({ tags: '@桌面' }, async ({ $test, isMobile }) => {
  $test.skip(isMobile, '只在桌面跑')
})
Before({ tags: '@手機' }, async ({ $test, isMobile }) => {
  $test.skip(!isMobile, '只在手機跑')
})

// 作答畫面被設為 inert 的背景：頁首、地圖與面板、頁尾
const background = (page: Page) => [page.locator('.layout > header'), page.locator('.layout > main'), page.locator('.layout > footer')]
const startButton = (page: Page) => page.getByRole('button', { name: '開始練習', exact: true })
const quiz = (page: Page) => page.getByRole('dialog')

// Safari／WebKit 預設按 Tab 只會移到輸入框與連結，要按 Option+Tab 才會移到按鈕
const tabKey = (browserName: string) => (browserName === 'webkit' ? 'Alt+Tab' : 'Tab')

async function openQuizWithKeyboard(page: Page, title: string) {
  await gotoConcept(page, title)
  await startButton(page).focus()
  await page.keyboard.press('Enter')
  await expect(quiz(page)).toBeVisible()
}

When('我用鍵盤移到「從這裡開始」並按 Enter', async ({ page }) => {
  await page.getByRole('button', { name: /^從這裡開始：/ }).focus()
  await page.keyboard.press('Enter')
})

Then('每個選項都是單選按鈕', async ({ page }) => {
  const question = await currentQuestion(page)
  await expect(page.getByRole('radiogroup', { name: '選項' }).getByRole('radio')).toHaveCount(question.options.length)
})

Then('報讀軟體進到選項時會先唸出題目', async ({ page }) => {
  const question = await currentQuestion(page)
  await expect(page.getByRole('radiogroup', { name: '選項' })).toHaveAccessibleDescription(question.stem)
})

Then(/^焦點停在地圖上，報讀軟體唸出目前在「(.+)」$/, async ({ page }, title: string) => {
  await expect(page.getByRole('img', { name: new RegExp(`目前在「${title}」`) })).toBeFocused()
})

Given(/^地圖正在顯示「(.+)」$/, async ({ page }, title: string) => {
  await gotoConcept(page, title)
  await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible()
})

// 方向鍵右／下是同一層的下一個主題，假題庫裡「資料來源」就排在「AI 治理」後面
When(/^我按方向鍵切換到「(.+)」$/, async ({ page }, title: string) => {
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible()
})

Then(/^焦點沒有被移到「(.+)」的面板裡$/, async ({ page }, title: string) => {
  await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible()
  await expect(page.locator('aside :focus')).toHaveCount(0)
})

// 手機要先點「開始練習」打開全螢幕作答
Given(/^畫面正在顯示「(.+)」的第 (\d+) 題$/, async ({ page, isMobile }, title: string, n: string) => {
  if (isMobile) await openQuizWithKeyboard(page, title)
  else await gotoConcept(page, title)
  await expect(page.getByText(`測試題：${title} 第 ${n} 題`, { exact: true })).toBeVisible()
})

When(/^我(?:用鍵盤)?選(正確|錯誤)答案並送出$/, async ({ page }, which: string) => {
  const question = await currentQuestion(page)
  const option = question.options.find((o) => (o.id === question.answer) === (which === '正確'))!
  // 空白鍵選答案、Enter 送出（單選題的鍵盤操作，見〈鍵盤作答〉）
  await page.getByRole('radiogroup', { name: '選項' }).getByRole('radio', { name: `${option.id} ${option.text}` }).focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('Enter')
})

Then(/^焦點停在「(答對了！|答錯了.+)」$/, async ({ page }, text: string) => {
  await expect(page.locator(':focus')).toContainText(text)
})

Then(/^再按一次 Tab，焦點移到「下一題」$/, async ({ page, browserName }) => {
  await page.keyboard.press(tabKey(browserName))
  await expect(page.getByRole('button', { name: '下一題 →' })).toBeFocused()
})

When(/^我還沒選答案就用鍵盤移到「送出答案」$/, async ({ page, browserName }) => {
  // 從最後一個選項往下按 Tab；送出按鈕不能按時會被略過
  await page.getByRole('radiogroup', { name: '選項' }).getByRole('radio').last().focus()
  await page.keyboard.press(tabKey(browserName))
})

Then('「送出答案」不能按', async ({ page }) => {
  await expect(page.getByRole('button', { name: '送出答案' })).toBeDisabled()
})

Then(/^焦點還在「(.+)」的題目裡$/, async ({ page }, title: string) => {
  const practice = page.locator('.practice').filter({ hasText: `測試題：${title}` })
  await expect(practice.locator(':focus')).toHaveCount(1)
})

When(/^我在「(.+)」點「開始練習」$/, async ({ page }, title: string) => {
  await gotoConcept(page, title)
  await startButton(page).click()
})

Then(/^焦點停在「(結束練習|開始練習)」$/, async ({ page }, name: string) => {
  await expect(page.getByRole('button', { name, exact: true })).toBeFocused()
})

Then('後面的地圖、頁首、頁尾都無法操作', async ({ page }) => {
  for (const el of background(page)) await expect(el).toHaveJSProperty('inert', true)
})

Then('後面的地圖、頁首、頁尾恢復可以操作', async ({ page }) => {
  for (const el of background(page)) await expect(el).toHaveJSProperty('inert', false)
})

Given(/^我打開了「(.+)」的作答畫面$/, async ({ page }, title: string) => {
  await openQuizWithKeyboard(page, title)
})

When('我從最後一個按鈕再按一次 Tab', async ({ page, browserName }) => {
  await quiz(page).getByRole('button').last().focus()
  await page.keyboard.press(tabKey(browserName))
})

Then('焦點還在作答畫面裡', async ({ page }) => {
  await expect(quiz(page).locator(':focus')).toHaveCount(1)
})

When('我按 Esc 結束練習', async ({ page }) => {
  await page.keyboard.press('Escape')
  await expect(quiz(page)).toBeHidden()
})

When(/^我答對第 (\d+) 題$/, async ({ page }, n: string) => {
  const question = await currentQuestion(page)
  expect(question.stem).toMatch(new RegExp(` 第 ${n} 題$`))
  const option = question.options.find((o) => o.id === question.answer)!
  await page.getByRole('radiogroup', { name: '選項' }).getByRole('radio', { name: `${option.id} ${option.text}` }).click()
  await page.getByRole('button', { name: '送出答案' }).click()
})

Then(/^畫面出現「(.+)」的升級卡$/, async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: true })).toBeVisible()
})

// 測試聽不到聲音：改查升級卡在 aria-live 區域裡，而且沒有被 inert 擋掉（被擋掉就不在無障礙樹裡，getByRole 找不到）
Then('螢幕報讀軟體讀得到這張升級卡', async ({ page }) => {
  // 升級卡幾秒後就消失，用一次檢查同時確認兩件事
  const live = page.getByRole('status').filter({ hasText: '升級為' }).and(page.locator('[aria-live="polite"]'))
  await expect(live).toBeVisible()
})

// 掃描結果留到「那麼」再檢查
const contrastViolations = new WeakMap<Page, string[]>()

When(/^我用自動無障礙檢查掃描(首頁|作答畫面)$/, async ({ page }, where: string) => {
  // 首頁等「從這裡開始」標籤出現（紀錄載入完成）再掃
  if (where === '首頁') await expect(page.getByText('從這裡開始', { exact: true })).toBeVisible()
  const result = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
  contrastViolations.set(page, result.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')}：${n.failureSummary}`)))
})


Then('沒有對比不足的文字', async ({ page }) => {
  expect(contrastViolations.get(page)).toEqual([])
})
