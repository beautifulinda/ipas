// 〈城鎮依練習成果升級〉的步驟定義
import { Given, Then, When } from 'quickpickle'
import { expect } from 'vitest'
import { milestoneText } from '~/utils/progression'
import { concept, question } from '../unit/fixtures'
import { answer, findConcept, findRegion, mainConcept, progression, type World } from './world'

Given(/^「(.+)」另外有 (\d+) 題還沒審核的草稿$/, (world: World, title, count) => {
  const target = findConcept(world, title)
  for (let i = 1; i <= Number(count); i++) target.questions.push(question(`${target.id}-draft-${i}`, false))
})

Given(/^地區「(.+)」另外有主題「(.+)」，還沒有任何題目$/, (world: World, region, title) => {
  findRegion(world, region).concepts.push({ ...concept(`K-${title}`), title })
})

function answerAll(world: World, title: string) {
  const target = findConcept(world, title)
  answer(world, target, target.questions.filter((q) => q.reviewed).map((_, i) => i + 1), true)
}

Given(/^「(.+)」已經是城堡$/, (world: World, title) => {
  answerAll(world, title)
  expect(progression(world).townLevels.get(findConcept(world, title).id)).toBe(3)
})

When('我還沒有作答任何題目', () => {})

When(/^我再作答第 (\d+) 題並答(對|錯)$/, (world: World, n, result) => {
  answer(world, mainConcept(world), [Number(n)], result === '對')
})

When(/^我答對「(.+)」的全部題目$/, (world: World, title) => {
  answerAll(world, title)
})

Then(/^地區「(.+)」蓋著雲霧$/, (world: World, region) => {
  expect(progression(world).exploredRegions.has(findRegion(world, region).id)).toBe(false)
})

Then(/^地區「(.+)」的雲霧散開$/, (world: World, region) => {
  expect(progression(world).exploredRegions.has(findRegion(world, region).id)).toBe(true)
})

Then(/^地區「(.+)」不會插旗$/, (world: World, region) => {
  expect(progression(world).flaggedRegions.has(findRegion(world, region).id)).toBe(false)
})

// 畫面上的訊息前面有圖示（例如 🏰），比對時略過
Then(/^畫面放煙火，並顯示「(.+)」$/, (world: World, text) => {
  expect(world.milestones.map((m) => milestoneText(m).replace(/^\S+ /, ''))).toContain(text)
})

Then('不會再放一次煙火', (world: World) => {
  expect(world.milestones).toEqual([])
})
