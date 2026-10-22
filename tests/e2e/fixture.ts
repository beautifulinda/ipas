/// <reference types="node" />
// E2E 用的假題庫（tests/e2e/fixtures/map.json），步驟用主題名稱找 ID 與題目
import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import type { TopicMap } from '../../types/map'

const fixture: TopicMap = JSON.parse(readFileSync(new URL('./fixtures/map.json', import.meta.url), 'utf8'))
export const concepts = fixture.subjects.flatMap((s) => s.categories.flatMap((c) => c.concepts))

export function conceptByTitle(title: string) {
  const found = concepts.find((c) => c.title === title)
  if (!found) throw new Error(`假題庫裡沒有主題「${title}」`)
  return found
}

export function conceptId(title: string) {
  return conceptByTitle(title).id
}

// 背景已經打開首頁；等網站初始化完（會用 vue-router 更新網址）再換網址，否則 page.goto 會被打斷
export async function gotoConcept(page: Page, title: string) {
  await page.waitForLoadState('networkidle')
  await page.goto(`./?at=${conceptId(title)}`)
}

// 從畫面上的題目文字找回假題庫裡的那一題，才知道哪個是正確答案
export async function currentQuestion(page: Page) {
  const stem = await page.getByText(/^測試題：.+ 第 \d+ 題$/).first().textContent()
  const [, title, n] = stem!.match(/^測試題：(.+) 第 (\d+) 題$/)!
  return conceptByTitle(title).questions[Number(n) - 1]
}


// 主題所在的地區 ID
export function regionIdOf(title: string) {
  const id = conceptId(title)
  for (const subject of fixture.subjects) {
    const found = subject.categories.find((c) => c.concepts.some((k) => k.id === id))
    if (found) return found.id
  }
  throw new Error(`找不到「${title}」所在的地區`)
}
