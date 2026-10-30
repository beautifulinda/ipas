// 〈主題全部作答完，提示下一站〉的步驟定義
import { Then, When } from 'quickpickle'
import { expect } from 'vitest'
import { practiceQuestions } from '~/utils/concepts'
import { nextStop, nextStopText } from '~/utils/progression'
import { answer, findConcept, progression, type World } from './world'

const next = (world: World, title: string) => nextStop(world.map, progression(world), findConcept(world, title).id)

When(/^我作答完「(.+)」的全部題目$/, (world: World, title) => {
  const target = findConcept(world, title)
  answer(world, target, practiceQuestions(target).map((_, i) => i + 1), true)
})

// 標籤在畫面上分兩行，需求裡寫成一行
Then(/^「(.+)」上方顯示「(🎉.+)」$/, (world: World, title, text) => {
  const id = next(world, title)
  expect(id).toBeDefined()
  const target = world.map.subjects[0].categories[0].concepts.find((c) => c.id === id)!
  expect(nextStopText(target.title).replace('\n', '')).toBe(text)
})

Then(/^「(.+)」的下一站是「(.+)」$/, (world: World, title, target) => {
  expect(next(world, title)).toBe(findConcept(world, target).id)
})

Then(/^「(.+)」沒有下一站$/, (world: World, title) => {
  expect(next(world, title)).toBeUndefined()
})
