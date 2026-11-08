// 〈梯次入口〉的步驟定義；背景的考古題題庫沿用〈模擬考〉的步驟（mockExam.steps.ts）
import { Given, Then, When } from 'quickpickle'
import { expect } from 'vitest'
import type { Concept, TopicMap } from '~/types/map'
import { findConcept as conceptById, practiceQuestions } from '~/utils/concepts'
import {
  ENTRY_ALL_TEXT,
  NO_PAST_PAPERS,
  PAPER_MISSING,
  SHOW_ALL_QUESTIONS,
  cellText,
  choiceLabel,
  currentPaperText,
  entryRows,
  filterMapByPaper,
  notInPaperText,
  paperParam,
  paperProgression,
  paperSubject,
  parsePaperParam,
  type PaperChoice,
} from '~/utils/paperEntry'
import { paperLabel } from '~/utils/pastPapers'
import { computeProgression, nextStop, recommendedStart, TOWN_LEVEL_NAMES } from '~/utils/progression'
import { pastConcept, pastQuestion as past, question } from '../unit/fixtures'
import { allConcepts, answer, type World } from './world'

interface EntryWorld extends World {
  // 目前選的考卷；undefined 是全部梯次
  choice?: PaperChoice
  // 換考卷前的城鎮等級
  levelsBefore?: Map<string, number>
}

const regionL12 = (world: World) => world.map.subjects.find((s) => s.id === 'L12')!.categories[0]

function conceptByTitle(map: TopicMap, title: string): Concept {
  const found = map.subjects.flatMap((s) => s.categories.flatMap((c) => c.concepts)).find((c) => c.title === title)
  if (!found) throw new Error(`需求裡沒有主題「${title}」`)
  return found
}

// 「115 年第三次 第二科」→ 考卷
function choiceFor(world: World, label: string): PaperChoice {
  for (const row of entryRows(world.map, [])) {
    for (const cell of row.papers) {
      if (cell && paperLabel(cell.paper.session, cell.paper.paper) === label) return { session: cell.paper.session, paper: cell.paper.paper }
    }
  }
  throw new Error(`題庫裡沒有考卷「${label}」`)
}

function cellFor(world: World, session: string, paper: string) {
  const row = entryRows(world.map, world.attempts).find((r) => r.title === session)
  if (!row) throw new Error(`入口沒有梯次「${session}」`)
  return row.papers[paper === '第一科' ? 0 : 1]
}

function viewMap(world: EntryWorld) {
  return world.choice ? filterMapByPaper(world.map, world.choice) : world.map
}

function viewProgression(world: EntryWorld) {
  const full = computeProgression(world.map, world.attempts)
  return world.choice ? paperProgression(full, viewMap(world), world.attempts) : full
}

// 把題目從原本的主題搬到新主題（每份考卷仍是 50 題）
function moveQuestions(world: World, title: string, ids: Set<string>) {
  const moved = []
  for (const concept of allConcepts(world)) {
    moved.push(...concept.questions.filter((q) => ids.has(q.id)))
    concept.questions = concept.questions.filter((q) => !ids.has(q.id))
  }
  regionL12(world).concepts.push(pastConcept(title, moved))
  return moved
}

const ids = (session: string, from: number, to: number) =>
  new Set(Array.from({ length: to - from + 1 }, (_, i) => past(session, 2, from + i).id))

Given(/^主題「RAG」有 115 年第三次 第二科 10 題、115 年第二次 第二科 6 題，另外有 2 題自編題$/, (world: EntryWorld) => {
  moveQuestions(world, 'RAG', new Set([...ids('115-S3', 1, 10), ...ids('115-S2', 1, 6)]))
  conceptByTitle(world.map, 'RAG').questions.push(question('RAG-自編-1'), question('RAG-自編-2'))
  world.choice = undefined
  world.clock = 0
})

Given(/^主題「提示工程」只有 115 年第二次 第二科的題目$/, (world: EntryWorld) => {
  moveQuestions(world, '提示工程', ids('115-S2', 26, 50))
})

Then(/^畫面列出「(.+)」「(.+)」，梯次由新到舊$/, (world: EntryWorld, first, second) => {
  expect(entryRows(world.map, world.attempts).map((r) => r.title)).toEqual([first, second])
})

Then(/^每個梯次左邊是「第一科」、右邊是「第二科」$/, (world: EntryWorld) => {
  for (const row of entryRows(world.map, world.attempts)) {
    if (row.papers[0]) expect(row.papers[0].paper.paper).toBe(1)
    if (row.papers[1]) expect(row.papers[1].paper.paper).toBe(2)
  }
})

Then(/^「(.+)」的「(第.科)」顯示「([^」]+)」(，不能點)?$/, (world: EntryWorld, session, paper, text, disabled) => {
  const cell = cellFor(world, session, paper)
  if (text === PAPER_MISSING || disabled) {
    expect(text).toBe(PAPER_MISSING)
    expect(cell).toBeUndefined()
  } else {
    expect(cell && cellText(cell)).toBe(text)
  }
})

Then(/^畫面下方有「(.+)」$/, (_world: EntryWorld, text) => {
  expect(ENTRY_ALL_TEXT).toBe(text)
})

Given(/^我在 (.+ 第.科)作答過 (\d+) 題，答對 (\d+) 題$/, (world: EntryWorld, label, count, correct) => {
  const choice = choiceFor(world, label)
  const items = entryRows(world.map, []).flatMap((r) => r.papers).find((c) => c && paperParam(c.paper) === paperParam(choice))!.paper.items
  items.slice(0, Number(count)).forEach((item, i) => {
    world.clock += 1
    const ok = i < Number(correct)
    world.attempts.push({
      questionId: item.question.id,
      conceptId: item.conceptId,
      choice: ok ? 'A' : 'B',
      correct: ok,
      answeredAt: new Date(Date.UTC(2026, 10, 8, 0, 0, world.clock)).toISOString(),
    })
  })
})

Given(/^我選了「(.+)」$/, (world: EntryWorld, label) => {
  world.choice = choiceFor(world, label)
  // 網址記住這份考卷，重新整理後還在同一份
  expect(parsePaperParam(paperParam(world.choice))).toEqual(world.choice)
  // 選了第二科就對準 L12 的島，地圖上方顯示目前的考卷
  expect(paperSubject(world.choice)).toBe(world.choice.paper === 1 ? 'L11' : 'L12')
  expect(currentPaperText(world.choice)).toBe(`目前：${label}`)
})

When(/^我打開主題「(.+)」$/, (world: EntryWorld, title) => {
  world.opened = title
})

Then(/^練習題只有 (\d+) 題，都是 (.+ 第.科) ?的題目$/, (world: EntryWorld, count, label) => {
  const concept = conceptById(viewMap(world), conceptByTitle(world.map, world.opened!).id)!
  const questions = practiceQuestions(concept)
  expect(questions).toHaveLength(Number(count))
  const choice = choiceFor(world, label)
  for (const q of questions) {
    expect(q.source.exams?.some((e) => e.session === choice.session && e.paper === choice.paper)).toBe(true)
  }
})

Then(/^「(.+)」的進度圓餅與題數只算這 (\d+) 題$/, (world: EntryWorld, title, count) => {
  expect(viewProgression(world).townProgress.get(conceptByTitle(world.map, title).id)?.total).toBe(Number(count))
})

Given(/^主題「(.+)」依全部題目算是「房子」$/, (world: EntryWorld, title) => {
  const concept = conceptByTitle(world.map, title)
  // 答對一半就是房子
  const half = Math.ceil(practiceQuestions(concept).length / 2)
  answer(world, concept, Array.from({ length: half }, (_, i) => i + 1), true)
  expect(computeProgression(world.map, world.attempts).townLevels.get(concept.id)).toBe(2)
})

When(/^我從「(.+)」換到「(.+)」$/, (world: EntryWorld, from, to) => {
  world.choice = choiceFor(world, from)
  world.levelsBefore = new Map(viewProgression(world).townLevels)
  world.choice = choiceFor(world, to)
})

Then(/^主題「(.+)」仍然是「(.+)」，不放升級演出$/, (world: EntryWorld, title, name) => {
  const id = conceptByTitle(world.map, title).id
  const level = viewProgression(world).townLevels.get(id)!
  expect(TOWN_LEVEL_NAMES[level as 0 | 1 | 2 | 3]).toBe(name)
  expect(level).toBe(world.levelsBefore!.get(id))
})

Then(/^「(.+)」的進度圓餅改成只算 (.+ 第.科) ?的 (\d+) 題$/, (world: EntryWorld, title, label, count) => {
  expect(choiceLabel(world.choice!)).toBe(label)
  expect(viewProgression(world).townProgress.get(conceptByTitle(world.map, title).id)?.total).toBe(Number(count))
})

When(/^我在主題「(.+)」答對一題，讓「.+」依全部題目算升到「帳篷」$/, (world: EntryWorld, title) => {
  // 作答的是這份考卷裡的第 1 題；升級照全部題目算
  const shown = conceptById(viewMap(world), conceptByTitle(world.map, title).id)!
  answer(world, shown, [1], true)
  expect(computeProgression(world.map, world.attempts).townLevels.get(shown.id)).toBe(1)
})

Then('和現在一樣放帳篷的升級演出', (world: EntryWorld) => {
  expect(world.plan?.milestone.kind).toBe('tent')
})

Then(/^「(.+)」的標籤變淡，不顯示進度圓餅$/, (world: EntryWorld, title) => {
  // 地圖把這份考卷沒有進度的主題畫成淡的
  expect(viewProgression(world).townProgress.has(conceptByTitle(world.map, title).id)).toBe(false)
})

Then(/^面板顯示「(.+)」$/, (world: EntryWorld, text) => {
  const concept = conceptById(viewMap(world), conceptByTitle(world.map, world.opened!).id)!
  expect(practiceQuestions(concept)).toHaveLength(0)
  expect(notInPaperText(world.choice!)).toBe(text)
})

Then(/^有按鈕「(.+)」$/, (_world: EntryWorld, text) => {
  expect(SHOW_ALL_QUESTIONS).toBe(text)
})

Then(/^「從這裡開始」標在這份考卷第一個還沒作答的主題$/, (world: EntryWorld) => {
  const full = computeProgression(world.map, world.attempts)
  // 全部梯次時會建議第一科的主題；選了第二科的考卷，就從第二科第一個有這份題目的主題開始
  expect(conceptById(world.map, recommendedStart(world.map, full)!)?.title).toBe('L11 主題')
  expect(conceptById(world.map, recommendedStart(viewMap(world), viewProgression(world))!)?.title).toBe('L12 主題甲')
})

Then(/^主題全部作答完時，「下一站」只找這份考卷還有題目沒作答的主題$/, (world: EntryWorld) => {
  const first = conceptById(viewMap(world), conceptByTitle(world.map, 'L12 主題甲').id)!
  answer(world, first, practiceQuestions(first).map((_, i) => i + 1), true)
  const next = nextStop(viewMap(world), viewProgression(world), first.id)
  // 下一個是「L12 主題乙」；「提示工程」只有別的梯次的題目，不會被選到
  expect(conceptById(world.map, next!)?.title).toBe('L12 主題乙')
})

When(/^我按地圖上方的「看全部梯次」$/, (world: EntryWorld) => {
  world.choice = undefined
})

Then(/^地圖上方不再顯示「目前：…」$/, (world: EntryWorld) => {
  expect(world.choice).toBeUndefined()
})

Then(/^主題「(.+)」的練習題有 (\d+) 題（.+）$/, (world: EntryWorld, title, count) => {
  expect(practiceQuestions(conceptById(viewMap(world), conceptByTitle(world.map, title).id)!)).toHaveLength(Number(count))
})

Given(/^(.+) (第.科)有 (\d+) 題已下架$/, (world: EntryWorld, session, paper, count) => {
  const choice = choiceFor(world, `${session} ${paper}`)
  const removed = new Set(
    entryRows(world.map, [])
      .flatMap((r) => r.papers)
      .find((c) => c && paperParam(c.paper) === paperParam(choice))!
      .paper.items.slice(0, Number(count))
      .map((item) => item.question.id),
  )
  for (const concept of allConcepts(world)) concept.questions = concept.questions.filter((q) => !removed.has(q.id))
})

Then(/^「(.+)」的「(第.科)」分母是 (\d+)$/, (world: EntryWorld, session, paper, total) => {
  expect(cellFor(world, session, paper)?.total).toBe(Number(total))
})

// 〈梯次入口（題庫沒有考古題時）〉：E2E 在瀏覽器裡測，這裡確認入口的文字
Given('題庫沒有考古題，只有自編題', (world: EntryWorld) => {
  world.map = {
    version: '1',
    updatedAt: '2026-11-08',
    disclaimer: '',
    subjects: [{ id: 'L11', title: '科目', categories: [{ id: 'C', title: '地區', concepts: [pastConcept('AI 治理', [question('q1')])] }] }],
  }
  world.attempts = []
  expect(entryRows(world.map, [])).toHaveLength(0)
  expect(NO_PAST_PAPERS).toBe('目前沒有考古題')
})
