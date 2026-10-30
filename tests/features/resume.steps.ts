// 〈回到主題時從上次的進度繼續〉的步驟定義
import { Given, Then, When } from 'quickpickle'
import { expect } from 'vitest'
import { practiceQuestions } from '~/utils/concepts'
import { resumeIndex } from '~/utils/progress'
import { groupOf } from '~/utils/questionGroups'
import { answer, findConcept, mainConcept, numbers, type World } from './world'

const allNumbers = (world: World) => practiceQuestions(mainConcept(world)).map((_, i) => i + 1)

Given(/^我已經作答第 (.+) 題$/, (world: World, list) => {
  answer(world, mainConcept(world), numbers(list), true)
})

Given(/^我答錯第 (\d+) 題、答對第 (\d+) 題$/, (world: World, wrong, right) => {
  answer(world, mainConcept(world), [Number(wrong)], false)
  answer(world, mainConcept(world), [Number(right)], true)
})

Given(/^我已經作答全部 (\d+) 題，第 (.+) 題答錯$/, (world: World, total, list) => {
  expect(allNumbers(world)).toHaveLength(Number(total))
  const wrong = numbers(list)
  answer(world, mainConcept(world), allNumbers(world).filter((n) => !wrong.includes(n)), true)
  answer(world, mainConcept(world), wrong, false)
})

Given(/^我已經答對全部 (\d+) 題$/, (world: World, total) => {
  expect(allNumbers(world)).toHaveLength(Number(total))
  answer(world, mainConcept(world), allNumbers(world), true)
})

// 離開再回來、重新整理網頁、第一次打開，畫面都是用作答紀錄決定停在哪一題（紀錄存在瀏覽器，重新整理後還在）
function open(world: World, title: string) {
  const ids = practiceQuestions(findConcept(world, title)).map((q) => q.id)
  world.resume = resumeIndex(ids, world.attempts) + 1
  // 題號列顯示目前這題所在的組（題號分組.feature）
  world.opened = title
  world.shownGroup = groupOf(world.resume - 1)
}

When(/^我離開「(.+)」再回來$/, (world: World, title) => open(world, title))
When(/^我重新整理網頁並打開「(.+)」$/, (world: World, title) => open(world, title))
When(/^我(?:第一次)?打開「(.+)」$/, (world: World, title) => open(world, title))

Then(/^畫面顯示第 (\d+) 題$/, (world: World, n) => {
  expect(world.resume).toBe(Number(n))
})
