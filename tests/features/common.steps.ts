// 多份需求共用的步驟：建立題庫、作答、城鎮等級
import { Given, Then, When } from 'quickpickle'
import { expect } from 'vitest'
import { TOWN_LEVEL_NAMES } from '~/utils/progression'
import { answer, findConcept, mainConcept, progression, setup, type World } from './world'

Given(/^地區「(.+)」裡有主題「(.+)」，主題有 (\d+) 題已審核的題目$/, (world: World, region, title, count) => {
  setup(world, region, title, Number(count))
})

Given(/^主題「(.+)」有第 1 題和第 2 題$/, (world: World, title) => {
  setup(world, '資料處理', title, 2)
})

When(/^我(?:再)?答(對|錯)第 (\d+) 題$/, (world: World, result, n) => {
  answer(world, mainConcept(world), [Number(n)], result === '對')
})

When(/^我答(對|錯)第 (\d+) 題和第 (\d+) 題$/, (world: World, result, a, b) => {
  answer(world, mainConcept(world), [Number(a), Number(b)], result === '對')
})

const LEVELS = Object.values(TOWN_LEVEL_NAMES).join('|')

Then(new RegExp(`^「(.+)」(?:顯示為|降回)(${LEVELS})$`), (world: World, title, level) => {
  const expected = Object.entries(TOWN_LEVEL_NAMES).find(([, name]) => name === level)![0]
  expect(progression(world).townLevels.get(findConcept(world, title).id)).toBe(Number(expected))
})
