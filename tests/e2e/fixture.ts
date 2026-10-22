/// <reference types="node" />
// E2E 用的假題庫（tests/e2e/fixtures/map.json），步驟用主題名稱找 ID 與題目
import { readFileSync } from 'node:fs'
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
