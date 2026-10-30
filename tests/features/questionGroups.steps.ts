// 〈題目多時題號分組顯示〉與〈每答一題都看得到進展〉圓餅、題數的步驟定義
import { Given, Then, When } from 'quickpickle'
import { expect } from 'vitest'
import { practiceQuestions } from '~/utils/concepts'
import { latestByQuestion } from '~/utils/progress'
import { progressText } from '~/utils/progression'
import { groupOf, groupProgressText, questionGroups, shownRange } from '~/utils/questionGroups'
import { answer, findConcept, mainConcept, numbers, progression, type World } from './world'

// 需求裡的組名用「1–10」這種寫法，比對時取出每個「」裡的文字
const quoted = (text: string) => [...text.matchAll(/「(.+?)」/g)].map((m) => m[1])

function openedQuestions(world: World) {
  return practiceQuestions(findConcept(world, world.opened ?? mainConcept(world).title))
}

function groups(world: World) {
  return questionGroups(openedQuestions(world).length)
}

function findGroup(world: World, label: string) {
  const found = groups(world).findIndex((g) => g.label === label)
  if (found < 0) throw new Error(`沒有分組「${label}」`)
  return found
}

// 換題：題號列跟著顯示新題目所在的組
function moveTo(world: World, n: number) {
  world.resume = n
  world.shownGroup = groupOf(n - 1)
}

Given(/^我答對第 (.+) 題、答錯第 (.+) 題$/, (world: World, right, wrong) => {
  answer(world, mainConcept(world), numbers(right), true)
  answer(world, mainConcept(world), numbers(wrong), false)
})

Given(/^我正在作答第 (\d+) 題$/, (world: World, n) => {
  world.opened = mainConcept(world).title
  moveTo(world, Number(n))
})

When(/^我點分組「(.+)」$/, (world: World, label) => {
  world.shownGroup = findGroup(world, label)
})

When('我按「下一題」', (world: World) => {
  moveTo(world, world.resume! + 1)
})

Then(/^畫面顯示分組((?:「.+?」)+)$/, (world: World, labels) => {
  expect(groups(world).map((g) => g.label)).toEqual(quoted(labels))
})

Then('畫面不顯示分組', (world: World) => {
  expect(groups(world)).toEqual([])
})

Then(/^(?:只)?顯示第 (\d+)～(\d+) 題的題號$/, (world: World, from, to) => {
  const { start, end } = shownRange(openedQuestions(world).length, world.shownGroup ?? 0)
  expect([start + 1, end]).toEqual([Number(from), Number(to)])
})

Then(/^畫面仍然顯示第 (\d+) 題$/, (world: World, n) => {
  expect(world.resume).toBe(Number(n))
})

Then(/^分組「(.+)」顯示「(.+)」$/, (world: World, label, text) => {
  const group = groups(world)[findGroup(world, label)]
  const latest = latestByQuestion(world.attempts)
  const correct = openedQuestions(world)
    .slice(group.start, group.end)
    .filter((q) => latest.get(q.id)?.correct).length
  expect(groupProgressText(group, correct)).toBe(text)
})

// 圓餅與題數

Then(/^「(.+)」的進度圓餅綠色 (\d+) 題、紅色 (\d+) 題、灰色 (\d+) 題$/, (world: World, title, right, wrong, rest) => {
  const progress = progression(world).townProgress.get(findConcept(world, title).id)!
  expect([progress.correct, progress.wrong, progress.total - progress.correct - progress.wrong]).toEqual(
    [right, wrong, rest].map(Number),
  )
})

When(/^我在地圖上選到「(.+)」$/, (world: World, title) => {
  world.selected = title
})

// 題數只顯示在地圖上選到的主題旁
Then(/^「(.+)」旁顯示「(.+)」$/, (world: World, title, text) => {
  expect(world.selected).toBe(title)
  expect(progressText(progression(world).townProgress.get(findConcept(world, title).id)!)).toBe(text)
})

Then(/^「(.+)」旁不顯示題數$/, (world: World, title) => {
  expect(world.selected).not.toBe(title)
})
