// 〈城鎮依練習成果升級〉的步驟定義：把中文需求的每一句對應到 utils/progression 的實際計算
import { Given, Then, When } from 'quickpickle'
import { expect } from 'vitest'
import type { Concept, TopicMap } from '~/types/map'
import type { Attempt } from '~/utils/progress'
import {
  TOWN_LEVEL_NAMES,
  computeProgression,
  milestoneText,
  newMilestones,
  type Milestone,
  type Progression,
} from '~/utils/progression'
import { concept, question } from '../unit/fixtures'

interface World {
  map: TopicMap
  attempts: Attempt[]
  // 最近一次作答前後的進度，用來判斷這次有沒有新達成的里程碑
  before?: Progression
  milestones: Milestone[]
}

const LEVELS = Object.values(TOWN_LEVEL_NAMES).join('|')

function findConcept(world: World, title: string) {
  for (const category of world.map.subjects[0].categories) {
    const found = category.concepts.find((c) => c.title === title)
    if (found) return found
  }
  throw new Error(`需求裡沒有主題「${title}」`)
}

function findRegion(world: World, title: string) {
  const found = world.map.subjects[0].categories.find((c) => c.title === title)
  if (!found) throw new Error(`需求裡沒有地區「${title}」`)
  return found
}

function current(world: World) {
  return computeProgression(world.map, world.attempts)
}

// 作答：記下作答前的進度，再加入紀錄，算出這次新達成的里程碑
function answer(world: World, target: Concept, numbers: number[], correct: boolean) {
  const before = current(world)
  for (const n of numbers) {
    const q = target.questions.filter((item) => item.reviewed)[n - 1]
    world.attempts.push({
      questionId: q.id,
      conceptId: target.id,
      choice: correct ? q.answer : 'X',
      correct,
      answeredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, world.attempts.length)).toISOString(),
    })
  }
  world.before = before
  world.milestones = newMilestones(world.map, before, current(world))
}

// 背景與前提

Given(/^地區「(.+)」裡有主題「(.+)」，主題有 (\d+) 題已審核的題目$/, (world: World, region, title, count) => {
  const id = `K-${title}`
  const questions = Array.from({ length: Number(count) }, (_, i) => question(`${id}-${i + 1}`))
  world.map = {
    version: '1',
    updatedAt: '2026-01-01',
    disclaimer: '',
    subjects: [
      {
        id: 'S',
        title: '科目',
        categories: [{ id: `C-${region}`, title: region, concepts: [{ ...concept(id, questions), title }] }],
      },
    ],
  }
  world.attempts = []
  world.milestones = []
})

Given(/^「(.+)」另外有 (\d+) 題還沒審核的草稿$/, (world: World, title, count) => {
  const target = findConcept(world, title)
  for (let i = 1; i <= Number(count); i++) target.questions.push(question(`${target.id}-draft-${i}`, false))
})

Given(/^地區「(.+)」另外有主題「(.+)」，還沒有任何題目$/, (world: World, region, title) => {
  findRegion(world, region).concepts.push({ ...concept(`K-${title}`), title })
})

Given(/^「(.+)」已經是城堡$/, (world: World, title) => {
  const target = findConcept(world, title)
  answer(world, target, target.questions.filter((q) => q.reviewed).map((_, i) => i + 1), true)
  expect(current(world).townLevels.get(target.id)).toBe(3)
})

// 作答

When('我還沒有作答任何題目', () => {})

function onlyConcept(world: World) {
  return world.map.subjects[0].categories[0].concepts[0]
}

When(/^我答(對|錯)第 (\d+) 題$/, (world: World, result, n) => {
  answer(world, onlyConcept(world), [Number(n)], result === '對')
})

When(/^我再作答第 (\d+) 題並答(對|錯)$/, (world: World, n, result) => {
  answer(world, onlyConcept(world), [Number(n)], result === '對')
})

When(/^我答(對|錯)第 (\d+) 題和第 (\d+) 題$/, (world: World, result, a, b) => {
  answer(world, onlyConcept(world), [Number(a), Number(b)], result === '對')
})

When(/^我答對「(.+)」的全部題目$/, (world: World, title) => {
  const target = findConcept(world, title)
  answer(world, target, target.questions.filter((q) => q.reviewed).map((_, i) => i + 1), true)
})

// 結果

Then(new RegExp(`^「(.+)」(?:顯示為|降回)(${LEVELS})$`), (world: World, title, level) => {
  const expected = Object.entries(TOWN_LEVEL_NAMES).find(([, name]) => name === level)![0]
  expect(current(world).townLevels.get(findConcept(world, title).id)).toBe(Number(expected))
})

Then(/^地區「(.+)」蓋著雲霧$/, (world: World, region) => {
  expect(current(world).exploredRegions.has(findRegion(world, region).id)).toBe(false)
})

Then(/^地區「(.+)」的雲霧散開$/, (world: World, region) => {
  expect(current(world).exploredRegions.has(findRegion(world, region).id)).toBe(true)
})

Then(/^地區「(.+)」不會插旗$/, (world: World, region) => {
  expect(current(world).flaggedRegions.has(findRegion(world, region).id)).toBe(false)
})

Then(/^畫面放煙火，並顯示「(.+)」$/, (world: World, text) => {
  expect(world.milestones.map(milestoneText).map((t) => t.replace(/^\S+ /, ''))).toContain(text)
})

Then('不會再放一次煙火', (world: World) => {
  expect(world.milestones).toEqual([])
})
