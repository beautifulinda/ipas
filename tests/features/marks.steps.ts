// 〈自己標記不熟的題目，和錯題一起複習〉的步驟定義
import { Given, Then, When } from 'quickpickle'
import { expect } from 'vitest'
import type { PastExam } from '~/types/map'
import { questionIndex } from '~/utils/concepts'
import { markedQuestions, parseExport, reviewList, toExport } from '~/utils/progress'
import {
  filterItems,
  filterLabels,
  groupScoreLabel,
  itemTags,
  recordMenuLabel,
  subjectTabLabel,
  wrongBookBySubject,
  type ReviewFilter,
  type WrongItem,
} from '~/utils/wrongBook'
import { question } from '../unit/fixtures'
import { answer, book, mainConcept, mark, questionId, type World } from './world'

interface MarkWorld extends World {
  // 需求裡說的「這一題」（考古題）
  target?: string
}

const id = (world: World, n: string | number) => questionId(mainConcept(world), Number(n))

// 和畫面一樣：只算網站上還有的題目
function known(world: World) {
  const ids = new Set(questionIndex(world.map).keys())
  return {
    wrong: book(world).filter((q) => ids.has(q)),
    marked: markedQuestions(world.marks).filter((q) => ids.has(q)),
    answered: new Set(world.attempts.map((a) => a.questionId).filter((q) => ids.has(q))),
  }
}

function subjects(world: World) {
  const { wrong, marked, answered } = known(world)
  return wrongBookBySubject(world.map, wrong, answered, marked)
}

// 複習清單裡的題目（考古題在不同梯次各列一次，這裡同一題只算一次）
function items(world: World, filter: ReviewFilter = 'all') {
  const found = new Map<string, WrongItem>()
  for (const subject of subjects(world)) {
    for (const group of subject.groups) {
      for (const item of filterItems(group.items, filter)) found.set(item.question.id, item)
    }
  }
  return found
}

// 標記與「我懂了」

When(/^我答(對|錯)第 (\d+) 題，並按「標記不熟」$/, (world: World, result, n) => {
  answer(world, mainConcept(world), [Number(n)], result === '對')
  mark(world, id(world, n), true)
})

When(/^我還沒作答第 (\d+) 題就按「標記不熟」$/, (world: World, n) => {
  expect(world.attempts.some((a) => a.questionId === id(world, n))).toBe(false)
  mark(world, id(world, n), true)
})

Given(/^第 (\d+) 題已標記不熟$/, (world: World, n) => {
  mark(world, id(world, n), true)
})

When(/^我在第 (\d+) 題按「我懂了」$/, (world: World, n) => {
  mark(world, id(world, n), false)
})

Then(/^複習清單裡(?:仍)?有第 (\d+) 題，(?:只)?標示「(.+)」$/, (world: World, n, tag) => {
  const item = items(world).get(id(world, n))
  expect(item && itemTags(item)).toEqual([tag])
})

Then(/^複習清單裡仍有第 (\d+) 題$/, (world: World, n) => {
  expect(items(world).has(id(world, n))).toBe(true)
})

Then(/^第 (\d+) 題同時標示「(.+)」和「(.+)」$/, (world: World, n, a, b) => {
  expect(itemTags(items(world).get(id(world, n))!)).toEqual([a, b])
})

Then('畫面不會詢問要不要移除', (world: World) => {
  expect(world.prompt).toBeUndefined()
})

Then('複習清單是空的', (world: World) => {
  expect(items(world).size).toBe(0)
})

Then(/^複習清單顯示 (\d+) 題$/, (world: World, count) => {
  expect(items(world).size).toBe(Number(count))
})

// 拿掉標記後，題目上又是「標記不熟」按鈕
Then(/^第 (\d+) 題又可以重新「標記不熟」$/, (world: World, n) => {
  expect(markedQuestions(world.marks)).not.toContain(id(world, n))
})

// 複習清單

When('我打開複習清單', () => {})

Then(/^看得到篩選「(.+)」「(.+)」「(.+)」$/, (world: World, all, wrong, marked) => {
  const labels = filterLabels(subjects(world)[0])
  expect([labels.all, labels.wrong, labels.marked]).toEqual([all, wrong, marked])
})

Then(/^選「(答錯|不熟)」時只列出第 (\d+) 題$/, (world: World, label, n) => {
  const filter: ReviewFilter = label === '答錯' ? 'wrong' : 'marked'
  expect([...items(world, filter).keys()]).toEqual([id(world, n)])
})

Then(/^頁首顯示「(.+)」$/, (world: World, text) => {
  const { wrong, marked } = known(world)
  expect(recordMenuLabel(reviewList(wrong, marked).length)).toBe(text)
})

Then(/^科目分頁顯示「(.+)」$/, (world: World, text) => {
  expect(subjectTabLabel(subjects(world)[0])).toMatch(new RegExp(`・${text}$`))
})

Given(/^一題 114 年第四次第一科的考古題已標記不熟，沒有答錯$/, (world: MarkWorld) => {
  const exams: PastExam[] = [{ session: '114-S4', paper: 1, number: 7 }]
  const past = { ...question('past-114-S4-1-07'), source: { type: 'official-past' as const, exams } }
  mainConcept(world).questions.push(past)
  world.target = past.id
  mark(world, past.id, true)
})

function paperGroup(world: World, title: string) {
  const group = subjects(world)[0].groups.find((g) => g.title === title)
  if (!group) throw new Error(`複習清單沒有「${title}」`)
  return group
}

Then(/^「(.+)」列出這一題$/, (world: MarkWorld, title) => {
  expect(paperGroup(world, title).items.map((item) => item.question.id)).toEqual([world.target])
})

Then(/^顯示「(錯 \d+／50)」$/, (world: World, text) => {
  expect(groupScoreLabel(paperGroup(world, '114 年第四次 第一科'))).toMatch(new RegExp(`^${text}`))
})

// 匯出檔經過 JSON 再讀回來，換成只有這些紀錄的另一台裝置
When('我匯出學習紀錄，在另一台裝置匯入', (world: World) => {
  const file = JSON.stringify(toExport(world.attempts, world.dismissals, world.marks))
  const imported = parseExport(file)
  world.attempts = imported.attempts
  world.dismissals = imported.dismissals
  world.marks = imported.marks
})

When(/^第 (\d+) 題從題庫下架$/, (world: World, n) => {
  const target = id(world, n)
  const concept = mainConcept(world)
  concept.questions = concept.questions.filter((q) => q.id !== target)
})
