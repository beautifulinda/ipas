// 〈錯題本〉的步驟定義
import { Given, Then, When } from 'quickpickle'
import { expect } from 'vitest'
import { answer, book, dismiss, mainConcept, questionId, type World } from './world'

const id = (world: World, n: string) => questionId(mainConcept(world), Number(n))

Given(/^第 (\d+) 題在錯題本裡$/, (world: World, n) => {
  answer(world, mainConcept(world), [Number(n)], false)
  expect(book(world)).toContain(id(world, n))
})

Given(/^第 (\d+) 題曾在錯題本裡，後來被我移除$/, (world: World, n) => {
  answer(world, mainConcept(world), [Number(n)], false)
  dismiss(world, id(world, n))
  expect(book(world)).not.toContain(id(world, n))
})

When(/^我答對第 (\d+) 題和第 (\d+) 題，但選擇「先保留」$/, (world: World, a, b) => {
  answer(world, mainConcept(world), [Number(a), Number(b)], true)
  expect(world.prompt, '應該要詢問是否移除').toBeDefined()
  world.prompt = undefined
})

When(/^我選擇「(移除|先保留)」$/, (world: World, choice) => {
  expect(world.prompt, '畫面沒有在詢問').toBeDefined()
  if (choice === '移除') dismiss(world, world.prompt!.questionId)
  world.prompt = undefined
})

Then(/^錯題本裡(?:仍)?有第 (\d+) 題$/, (world: World, n) => {
  expect(book(world)).toContain(id(world, n))
})

Then(/^在我回答之前，第 (\d+) 題仍在錯題本裡$/, (world: World, n) => {
  expect(book(world)).toContain(id(world, n))
})

Then(/^錯題本顯示 (\d+) 題$/, (world: World, count) => {
  expect(book(world)).toHaveLength(Number(count))
})

Then('錯題本是空的', (world: World) => {
  expect(book(world)).toEqual([])
})

Then(/^畫面詢問「(.+)」$/, (world: World, text) => {
  expect(world.prompt?.text).toBe(text)
})
