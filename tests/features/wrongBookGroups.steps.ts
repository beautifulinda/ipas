// 〈錯題本〉分科目、分梯次的步驟定義
import { Given, Then, When } from 'quickpickle'
import { expect } from 'vitest'
import type { Concept, PastExam, Question, TopicMap } from '~/types/map'
import { paperLabel } from '~/utils/pastPapers'
import { groupEmptyText, groupScoreLabel, subjectTabLabel, wrongBookBySubject } from '~/utils/wrongBook'
import { question } from '../unit/fixtures'
import { answer, book, type World } from './world'

interface GroupWorld extends World {
  // 正在看的科目分頁；沒選時和畫面一樣，先顯示有錯題的科目
  subject?: string
  // 需求裡說的「這題」、正在看的梯次
  target?: string
  groupTitle?: string
}

// 假題庫：L11 有三個梯次的第一科（每次 50 題）與兩題自編題，L12 有一個梯次的第二科；題目內容一律是假的
const L11_SESSIONS = ['114-S4', '115-S1', '115-S3']
const L12_SESSIONS = ['115-S3']

function past(session: string, paper: 1 | 2, number: number): Question {
  const exams: PastExam[] = [{ session, paper, number }]
  return { ...question(`${session}-${paper}-${number}`), source: { type: 'official-past', exams } }
}

function paperQuestions(sessions: string[], paper: 1 | 2) {
  return sessions.flatMap((session) => Array.from({ length: 50 }, (_, i) => past(session, paper, i + 1)))
}

function examMap(): TopicMap {
  const pastConcept = (id: string, questions: Question[]): Concept => ({ id, title: id, summary: '', keyPoints: [], questions })
  return {
    version: '1',
    updatedAt: '2026-10-26',
    disclaimer: '',
    subjects: [
      {
        id: 'L11',
        title: '人工智慧基礎概論',
        categories: [
          {
            id: 'L111',
            title: '地區一',
            concepts: [
              pastConcept('L11 考古題', paperQuestions(L11_SESSIONS, 1)),
              pastConcept('L11 自編題', [question('own-1'), question('own-2')]),
            ],
          },
        ],
      },
      {
        id: 'L12',
        title: '生成式 AI 應用與規劃',
        categories: [{ id: 'L121', title: '地區二', concepts: [pastConcept('L12 考古題', paperQuestions(L12_SESSIONS, 2))] }],
      },
    ],
  }
}

// 背景建立的是單一科目的題庫，這裡的場景改用分科目的假題庫
function useExamMap(world: GroupWorld) {
  if (world.map.subjects[0].id !== 'L11') world.map = examMap()
}

function allConcepts(world: World) {
  return world.map.subjects.flatMap((s) => s.categories.flatMap((c) => c.concepts))
}

function answerQuestion(world: World, id: string, correct: boolean) {
  for (const concept of allConcepts(world)) {
    const n = concept.questions.findIndex((q) => q.id === id)
    if (n >= 0) return answer(world, concept, [n + 1], correct)
  }
  throw new Error(`題庫裡沒有題目 ${id}`)
}

// 「115 年第三次」→ "115-S3"
function sessionOf(label: string) {
  const found = [...L11_SESSIONS, ...L12_SESSIONS].find((s) => paperLabel(s, 1).startsWith(label))
  if (!found) throw new Error(`假題庫裡沒有「${label}」`)
  return found
}

function subjects(world: World) {
  const answered = new Set(world.attempts.map((a) => a.questionId))
  return wrongBookBySubject(world.map, book(world), answered)
}

function currentSubject(world: GroupWorld) {
  const all = subjects(world)
  return all.find((s) => s.id === world.subject) ?? all.find((s) => s.wrongCount) ?? all[0]
}

function group(world: GroupWorld, title: string) {
  const found = currentSubject(world).groups.find((g) => g.title === title)
  if (!found) throw new Error(`錯題本沒有「${title}」`)
  return found
}

Given('我答錯一題 L11 的題目和兩題 L12 的題目', (world: GroupWorld) => {
  useExamMap(world)
  answerQuestion(world, '115-S3-1-1', false)
  answerQuestion(world, '115-S3-2-1', false)
  answerQuestion(world, '115-S3-2-2', false)
})

Given(/^(\d+ 年第.+次) 第一科我作答了 (\d+) 題，錯 (\d+) 題$/, (world: GroupWorld, label, total, wrong) => {
  useExamMap(world)
  const session = sessionOf(label)
  for (let n = 1; n <= Number(total); n++) answerQuestion(world, `${session}-1-${n}`, n > Number(wrong))
})

Given(/^某題在 (\d+ 年第.+次)和 (\d+ 年第.+次)的第一科都考過$/, (world: GroupWorld, a, b) => {
  useExamMap(world)
  const first = sessionOf(a)
  const second = sessionOf(b)
  // 同一題合併後只留一題，出處列出兩次；另一個梯次原本那題拿掉
  const concept = allConcepts(world).find((c) => c.id === 'L11 考古題')!
  concept.questions = concept.questions.filter((q) => q.id !== `${second}-1-50`)
  const merged = concept.questions.find((q) => q.id === `${first}-1-1`)!
  merged.source = { ...merged.source, exams: [...merged.source.exams!, { session: second, paper: 1, number: 50 }] }
  world.target = merged.id
})

Given('我答錯一題 L11 的自編題', (world: GroupWorld) => {
  useExamMap(world)
  answerQuestion(world, 'own-1', false)
})

Given(/^我沒有作答過 (\d+ 年第.+次) 第一科的題目$/, (world: GroupWorld, label) => {
  useExamMap(world)
  const session = sessionOf(label)
  expect(world.attempts.some((a) => a.questionId.startsWith(`${session}-1-`))).toBe(false)
})

When('我打開錯題本', (world: GroupWorld) => {
  world.subject = undefined
})

When(/^我在錯題本看 (L1\d)$/, (world: GroupWorld, id) => {
  world.subject = id
})

When('我答錯這題', (world: GroupWorld) => {
  answerQuestion(world, world.target!, false)
})

Then(/^看得到「(.+)」和「(.+)」兩個分頁$/, (world: GroupWorld, a, b) => {
  expect(subjects(world).map(subjectTabLabel)).toEqual([a, b])
})

Then(/^選 (L1\d) 時只列出 \1 的錯題$/, (world: GroupWorld, id) => {
  world.subject = id
  const ids = currentSubject(world).groups.flatMap((g) => g.items.map((w) => w.question.id))
  const own = new Set(world.map.subjects.find((s) => s.id === id)!.categories.flatMap((c) => c.concepts.flatMap((k) => k.questions.map((q) => q.id))))
  expect(ids.length).toBeGreaterThan(0)
  expect(ids.every((q) => own.has(q))).toBe(true)
})

Then(/^「(.+ 第.科)」顯示「(.+)」$/, (world: GroupWorld, title, text) => {
  world.groupTitle = title
  expect(groupScoreLabel(group(world, title))).toBe(text)
})

Then('梯次由新到舊排列', (world: GroupWorld) => {
  const titles = currentSubject(world).groups.filter((g) => g.size).map((g) => g.title)
  expect(titles).toEqual(['115 年第三次 第一科', '115 年第一次 第一科', '114 年第四次 第一科'])
})

Then('兩個梯次都顯示錯 1 題', (world: GroupWorld) => {
  const counts = currentSubject(world)
    .groups.filter((g) => g.items.some((w) => w.question.id === world.target))
    .map((g) => g.items.filter((w) => w.wrong).length)
  expect(counts).toEqual([1, 1])
})

Then(/^(L1\d) 分頁只算錯 (\d+) 題$/, (world: GroupWorld, id, count) => {
  const subject = subjects(world).find((s) => s.id === id)!
  expect(subject.wrongCount).toBe(Number(count))
  expect(subjectTabLabel(subject)).toBe(`${id}・複習 ${count}`)
})

Then(/^錯題列在「(.+)」，排在所有梯次之後$/, (world: GroupWorld, title) => {
  const last = currentSubject(world).groups.at(-1)!
  world.groupTitle = title
  expect(last.title).toBe(title)
  expect(last.items.map((w) => w.question.id)).toEqual(['own-1'])
})

Then('只顯示錯幾題，不顯示「／50」', (world: GroupWorld) => {
  expect(groupScoreLabel(group(world, world.groupTitle!))).toBe('錯 1 題')
})

Then(/^展開後顯示「(.+)」$/, (world: GroupWorld, text) => {
  expect(groupEmptyText(group(world, world.groupTitle!))).toBe(text)
})
