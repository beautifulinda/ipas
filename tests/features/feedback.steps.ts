// 〈每答一題都看得到進展〉與〈建議從哪個主題開始練習〉的步驟定義
import { Given, Then, When, type DataTable } from 'quickpickle'
import { expect } from 'vitest'
import { recommendedStart } from '~/utils/progression'
import { concept, question } from '../unit/fixtures'
import { answer, findConcept, mainConcept, progression, setup, type World } from './world'

// 進度

Given(/^我已經答對第 (\d+) 題$/, (world: World, n) => {
  answer(world, mainConcept(world), [Number(n)], true)
})

Given(/^「(.+)」已經是房子$/, (world: World, title) => {
  const target = findConcept(world, title)
  const half = Math.ceil(target.questions.filter((q) => q.reviewed).length / 2)
  answer(world, target, Array.from({ length: half }, (_, i) => i + 1), true)
  expect(progression(world).townLevels.get(target.id)).toBe(2)
})

Then(/^「(.+)」的進度圓餅顯示 (\d+)／(\d+)$/, (world: World, title, correct, total) => {
  expect(progression(world).townProgress.get(findConcept(world, title).id)).toMatchObject({
    correct: Number(correct),
    total: Number(total),
  })
})

Then(/^「(.+)」不顯示進度圓餅$/, (world: World, title) => {
  expect(progression(world).townProgress.has(findConcept(world, title).id)).toBe(false)
})

// 從這裡開始

Given(/^地圖上依官方順序有.個主題：$/, (world: World, table: DataTable) => {
  const rows = table.hashes() as { 主題: string; 題數: string }[]
  setup(world, '主題區', rows[0].主題, 0)
  const concepts = world.map.subjects[0].categories[0].concepts
  concepts.length = 0
  for (const row of rows) {
    const id = `K-${row.主題}`
    const questions = Array.from({ length: Number(row.題數) }, (_, i) => question(`${id}-${i + 1}`))
    concepts.push({ ...concept(id, questions), title: row.主題 })
  }
})

Given('三個主題都還沒有題目', (world: World) => {
  for (const c of world.map.subjects[0].categories[0].concepts) c.questions = []
})

When(/^我答(對|錯)「(.+)」的第 (\d+) 題$/, (world: World, result, title, n) => {
  answer(world, findConcept(world, title), [Number(n)], result === '對')
})

When(/^我作答過「(.+)」和「(.+)」$/, (world: World, a, b) => {
  for (const title of [a, b]) answer(world, findConcept(world, title), [1], false)
})

const start = (world: World) => recommendedStart(world.map, progression(world))

Then(/^「(.+)」上方顯示「從這裡開始」$/, (world: World, title) => {
  expect(start(world)).toBe(findConcept(world, title).id)
})

// 一次只會建議一個主題
Then('其他主題都沒有這個標記', (world: World) => {
  expect(start(world)).toBeDefined()
})

Then(/^「(.+)」不再顯示這個標記$/, (world: World, title) => {
  expect(start(world)).not.toBe(findConcept(world, title).id)
})

Then('地圖上沒有「從這裡開始」的標記', (world: World) => {
  expect(start(world)).toBeUndefined()
})
