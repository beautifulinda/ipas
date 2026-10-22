// 〈城鎮依練習成果升級〉的步驟定義
import { Given, Then, When } from 'quickpickle'
import { expect } from 'vitest'
import { isMajorMilestone, milestoneText, type Milestone } from '~/utils/progression'
import { concept, question } from '../unit/fixtures'
import { answer, findConcept, findRegion, mainConcept, progression, type World } from './world'

Given(/^「(.+)」另外有 (\d+) 題還沒審核的草稿$/, (world: World, title, count) => {
  const target = findConcept(world, title)
  for (let i = 1; i <= Number(count); i++) target.questions.push(question(`${target.id}-draft-${i}`, false))
})

Given(/^地區「(.+)」另外有主題「(.+)」，還沒有任何題目$/, (world: World, region, title) => {
  findRegion(world, region).concepts.push({ ...concept(`K-${title}`), title })
})

Given(/^地區「(.+)」另外有主題「(.+)」，主題有 (\d+) 題已審核的題目$/, (world: World, region, title, count) => {
  const id = `K-${title}`
  const questions = Array.from({ length: Number(count) }, (_, i) => question(`${id}-${i + 1}`))
  findRegion(world, region).concepts.push({ ...concept(id, questions), title })
})

Given(/^地區「(.+)」是島「(.+)」上唯一的地區$/, (world: World, region, island) => {
  const subject = world.map.subjects[0]
  expect(subject.categories.map((c) => c.title)).toEqual([region])
  subject.title = island
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

Then(/^地區「(.+)」插上旗子$/, (world: World, region) => {
  expect(progression(world).flaggedRegions.has(findRegion(world, region).id)).toBe(true)
})

Then(/^島「(.+)」的燈塔亮起$/, (world: World, island) => {
  const subject = world.map.subjects.find((s) => s.title === island)
  if (!subject) throw new Error(`需求裡沒有島「${island}」`)
  expect(progression(world).litIslands.has(subject.id)).toBe(true)
})

// 畫面上的訊息前面有圖示（例如 🏰），比對時略過
const texts = (milestones: Milestone[]) => milestones.map((m) => milestoneText(m).replace(/^\S+ /, ''))

Then(/^畫面放煙火，並顯示「(.+)」$/, (world: World, text) => {
  expect(world.milestones.length).toBeGreaterThan(0)
  expect(texts(world.milestones.filter((m) => !isMajorMilestone(m)))).toContain(text)
})

Then(/^畫面放煙火，並出現里程碑匾額「(.+)」$/, (world: World, text) => {
  expect(world.milestones.length).toBeGreaterThan(0)
  expect(texts(world.milestones.filter(isMajorMilestone))).toContain(text)
})

Then(/^不會另外顯示「(.+)」$/, (world: World, text) => {
  expect(texts(world.milestones)).not.toContain(text)
})

Then(/^不會(?:再)?放(?:一次)?煙火$/, (world: World) => {
  expect(world.milestones).toEqual([])
})
