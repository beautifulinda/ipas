// 〈公開考古題並標示出處〉的步驟定義
// 題目內容一律是假的，不可複製任何一句真的考古題
import { Given, Then, When } from 'quickpickle'
import { expect } from 'vitest'
import type { PastExam, Question, TopicMap } from '~/types/map'
import { practiceQuestions, questionIndex } from '~/utils/concepts'
import {
  COPYRIGHT_NOTICE,
  PAST_PAPERS_URL,
  checkPastPapers,
  examLabel,
  explanationText,
  findLeaks,
  isPastPaper,
  mergePastPapers,
  privateBankError,
  sessionLabel,
  sourceBadge,
  sourceLabel,
  verdictText,
  type PastPaperItem,
} from '~/utils/pastPapers'
import { knownAttempts, removedNotice, removedQuestionIds, summary } from '~/utils/progress'
import {
  expansionNotices,
  expansionText,
  newMilestones,
  townSnapshot,
  type Progression,
  type TownSnapshot,
} from '~/utils/progression'
import { withExtraQuestions } from '~/utils/questionBank'
import readme from '../../README.md?raw'
import { question } from '../unit/fixtures'
import { book, findConcept, progression, setup, type World } from './world'

interface PastWorld extends World {
  base: TopicMap // 公開題庫（自編題）
  past: PastPaperItem[] // 私人題庫（考古題，合併前）
  current?: Question
  viewing: Question[]
  errors: string[]
  missing?: string
  sources: { name: string; text: string }[]
  snapshot?: TownSnapshot
  before?: Progression
}

const SESSION_NUMBERS: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
const PAPERS: Record<string, 1 | 2> = { 一: 1, 二: 2 }

// 「114 年第四次 第一科 第 1 題」→ { session: '114-S4', paper: 1, number: 1 }
function parseExam(text: string): PastExam {
  const match = /^(\d{3}) 年第(.)次 第(.)科 第 (\d+) 題$/.exec(text.trim())
  if (!match) throw new Error(`看不懂的出處「${text}」`)
  return { session: `${match[1]}-S${SESSION_NUMBERS[match[2]]}`, paper: PAPERS[match[3]], number: Number(match[4]) }
}

const examId = (exam: PastExam) => `past-${exam.session}-${exam.paper}-${String(exam.number).padStart(2, '0')}`

function pastItem(conceptId: string, exam: PastExam, stem?: string): PastPaperItem {
  const id = examId(exam)
  return {
    conceptId,
    question: {
      ...question(id),
      stem: stem ?? `這是測試用的假考古題，代號 ${id}，不是官方試題內容`,
      source: { type: 'official-past', exams: [exam] },
    },
  }
}

// 重新組出網站看到的題庫：公開題庫＋合併後的私人題庫
function rebuild(world: PastWorld) {
  world.map = withExtraQuestions(world.base, mergePastPapers(world.past).items)
}

const governance = (world: PastWorld) => findConcept(world, 'AI 治理')
const firstPast = (world: PastWorld) => world.past[0]
const visiblePast = (world: PastWorld) => practiceQuestions(governance(world)).filter(isPastPaper)
const shownQuestion = (world: PastWorld) => world.current ?? visiblePast(world)[0]

function answerPast(world: PastWorld, id: string, correct: boolean) {
  world.attempts.push({
    questionId: id,
    conceptId: governance(world).id,
    choice: correct ? 'A' : 'B',
    correct,
    answeredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, world.attempts.length + 1)).toISOString(),
  })
}

const knownIds = (world: PastWorld) => new Set(questionIndex(world.map).keys())
const visibleWrongBook = (world: PastWorld) => book(world).filter((id) => knownIds(world).has(id))

// 背景

Given(/^「AI 治理」有一題考古題，出處是 (.+)$/, (world: PastWorld, exam) => {
  setup(world, '治理', 'AI 治理', 0)
  world.map.subjects[0].id = 'L11'
  world.base = world.map
  world.past = [pastItem(governance(world).id, parseExam(exam))]
  world.sources = []
  world.errors = []
  world.viewing = []
  rebuild(world)
})

Given('「AI 治理」有一題自己撰寫的題目', (world: PastWorld) => {
  findConcept({ ...world, map: world.base }, 'AI 治理').questions.push({ ...question('own-1'), explanation: '自己寫的解析' })
  rebuild(world)
})

// 顯示

When('我作答這題考古題', (world: PastWorld) => {
  world.current = visiblePast(world).find((q) => q.id === firstPast(world).question.id)
  answerPast(world, world.current!.id, false)
})

When('我看「AI 治理」的練習題', (world: PastWorld) => {
  world.viewing = practiceQuestions(governance(world))
})

Then(/^題目下方顯示「(.+)」$/, (world: PastWorld, text) => {
  expect(sourceLabel(shownQuestion(world))).toBe(text)
})

Then(/^一樣顯示「(.+)」$/, (world: PastWorld, text) => {
  expect(sourceLabel(shownQuestion(world))).toBe(text)
})

Then('有一個連到 iPAS 官網「學習資源」頁的連結，那裡有歷屆試題公告', () => {
  expect(PAST_PAPERS_URL).toBe('https://ipd.nat.gov.tw/ipas/certification/AIAP/learning-resources')
})

Then(/^考古題標示「(.+)」$/, (world: PastWorld, label) => {
  const past = world.viewing.filter(isPastPaper)
  expect(past.length).toBeGreaterThan(0)
  for (const q of past) expect(sourceBadge(q)).toBe(label)
})

Then(/^自己撰寫的題目標示「(.+)」$/, (world: PastWorld, label) => {
  const own = world.viewing.filter((q) => !isPastPaper(q))
  expect(own.length).toBeGreaterThan(0)
  for (const q of own) expect(sourceBadge(q)).toBe(label)
})

Given(/^「AI 治理」另有一題考古題，出處是 (.+)$/, (world: PastWorld, exam) => {
  world.past.push(pastItem(governance(world).id, parseExam(exam)))
  rebuild(world)
})

Then(/^題目依序是 (.+)$/, (world: PastWorld, order) => {
  const describe = (q: Question) =>
    isPastPaper(q) ? `${sessionLabel(q.source.exams!.at(-1)!.session)}的考古題` : '自編題'
  expect(world.viewing.map(describe).join('、')).toBe(order)
})

Given('這題考古題沒有解析', (world: PastWorld) => {
  expect(firstPast(world).question.explanation).toBe('')
})

Then('顯示正確答案', (world: PastWorld) => {
  expect(verdictText(world.current!, false)).toContain(world.current!.answer)
})

Then(/^解析的位置顯示「(.+)」$/, (world: PastWorld, text) => {
  expect(explanationText(world.current!)).toBe(text)
})

// 部署前的檢查

Given('所有考古題都有梯次、考科與題號', (world: PastWorld) => {
  for (const item of world.past) expect(item.question.source.exams?.length).toBeGreaterThan(0)
})

When('執行部署前的檢查', (world: PastWorld) => {
  world.errors = [...checkPastPapers(world.past, world.map), ...findLeaks(world.sources, world.past)]
})

Then('檢查通過', (world: PastWorld) => {
  expect(world.errors).toEqual([])
})

Then('公開網站可以練習考古題', (world: PastWorld) => {
  expect(visiblePast(world).length).toBeGreaterThan(0)
})

When('我打開網站', () => {})

Then(/^頁尾看得到「(.+)」$/, (_world: PastWorld, text) => {
  expect(COPYRIGHT_NOTICE).toBe(text)
})

Then('README 有同樣的聲明', () => {
  expect(readme).toContain(COPYRIGHT_NOTICE)
})

// 錯題本與作答紀錄

Given('這題考古題答錯，進了錯題本', (world: PastWorld) => {
  answerPast(world, firstPast(world).question.id, false)
  expect(visibleWrongBook(world)).toContain(firstPast(world).question.id)
})

When('我從錯題本點這題，前往「AI 治理」作答', (world: PastWorld) => {
  const entry = questionIndex(world.map).get(visibleWrongBook(world)[0])!
  expect(entry.conceptTitle).toBe('AI 治理')
  world.current = entry.question
})

// 同一題考過多次

function samePastQuestion(world: PastWorld, exam: string, reorder = false) {
  const original = firstPast(world)
  const copy = pastItem(original.conceptId, parseExam(exam), original.question.stem)
  if (reorder) {
    // 選項順序反過來，答案代號跟著變，但答案的選項文字不變
    const texts = [...original.question.options].reverse()
    copy.question.options = texts.map((o, i) => ({ id: String.fromCharCode(65 + i), text: o.text }))
    const answerText = original.question.options.find((o) => o.id === original.question.answer)!.text
    copy.question.answer = copy.question.options.find((o) => o.text === answerText)!.id
  }
  world.past.push(copy)
  rebuild(world)
  return copy
}

Given(/^(.+題)和「AI 治理」那題考古題是同一題$/, (world: PastWorld, exam) => {
  samePastQuestion(world, exam)
})

Then('這題只出現一次', (world: PastWorld) => {
  expect(world.viewing.filter(isPastPaper)).toHaveLength(1)
})

Then('進度圓餅把這題只算成 1 題', (world: PastWorld) => {
  expect(progression(world).townProgress.get(governance(world).id)?.total).toBe(world.viewing.length)
  expect(world.viewing.filter(isPastPaper)).toHaveLength(1)
})

Given(/^(.+題)和「AI 治理」那題考古題的題目相同、選項相同但順序不同$/, (world: PastWorld, exam) => {
  samePastQuestion(world, exam, true)
})

Given('兩次的答案代號不同，但答案的選項文字相同', (world: PastWorld) => {
  const [a, b] = world.past.map((item) => item.question)
  expect(a.answer).not.toBe(b.answer)
  const text = (q: Question) => q.options.find((o) => o.id === q.answer)!.text
  expect(text(a)).toBe(text(b))
})

Then('檢查通過，兩次算同一題', (world: PastWorld) => {
  expect(world.errors).toEqual([])
  expect(mergePastPapers(world.past).items).toHaveLength(1)
})

Given('我答錯過「AI 治理」那題考古題', (world: PastWorld) => {
  answerPast(world, firstPast(world).question.id, false)
})

When(/^新增的 (.+)試題裡有同一題$/, (world: PastWorld, session) => {
  samePastQuestion(world, `${session} 第一科 第 7 題`)
})

Then(/^這題的出處多了 (.+)$/, (world: PastWorld, session) => {
  const merged = visiblePast(world).find((q) => q.id === firstPast(world).question.id)!
  expect(merged.source.exams!.map((e) => sessionLabel(e.session))).toContain(session)
})

Then('我的作答紀錄仍對應到這題，它還在錯題本裡', (world: PastWorld) => {
  expect(visibleWrongBook(world)).toContain(firstPast(world).question.id)
})

// 題庫擴充造成降級

When(/^題庫在「AI 治理」新增了 (\d+) 題考古題，我重新打開網站$/, (world: PastWorld, count) => {
  world.snapshot = townSnapshot(world.map, progression(world))
  world.before = progression(world)
  for (let n = 1; n <= Number(count); n++) {
    world.past.push(pastItem(governance(world).id, { session: '115-S1', paper: 1, number: n }))
  }
  rebuild(world)
})

Then('「AI 治理」依新的題數重新計算等級', (world: PastWorld) => {
  const total = practiceQuestions(governance(world)).length
  expect(progression(world).townProgress.get(governance(world).id)?.total).toBe(total)
  expect(progression(world).townLevels.get(governance(world).id)).toBeLessThan(3)
})

Then(/^顯示一次「(.+)」$/, (world: PastWorld, text) => {
  const notices = expansionNotices(world.map, world.snapshot, townSnapshot(world.map, progression(world)))
  expect(notices.map(expansionText)).toEqual([text])
})

Then('不會放煙火，下次打開也不會再顯示', (world: PastWorld) => {
  expect(newMilestones(world.map, world.before!, progression(world))).toEqual([])
  const now = townSnapshot(world.map, progression(world))
  expect(expansionNotices(world.map, now, now)).toEqual([])
})

// 下架與重新上架

Given(/^(?:下架前)?我答錯過一題考古題(?:，它在錯題本裡)?$/, (world: PastWorld) => {
  answerPast(world, firstPast(world).question.id, false)
  expect(visibleWrongBook(world)).toContain(firstPast(world).question.id)
})

Given('作者把考古題從私人題庫移除', (world: PastWorld) => {
  world.past = []
  rebuild(world)
})

When('重新部署後我打開網站', () => {})

When('這題重新上架', (world: PastWorld) => {
  const all = world.past
  world.past = []
  rebuild(world)
  expect(visibleWrongBook(world)).toEqual([])
  world.past = all
  rebuild(world)
})

Then('公開網站上沒有任何一題考古題', (world: PastWorld) => {
  expect([...questionIndex(world.map).values()].filter((entry) => isPastPaper(entry.question))).toEqual([])
})

Then('錯題本不列出下架的題目', (world: PastWorld) => {
  expect(visibleWrongBook(world)).toEqual([])
})

Then('已作答次數與答對率只算還在網站上的題目', (world: PastWorld) => {
  expect(summary(knownAttempts(world.attempts, knownIds(world))).total).toBe(0)
})

Then(/^「學習紀錄」裡顯示「(.+)」$/, (world: PastWorld, text) => {
  expect(removedNotice(removedQuestionIds(world.attempts, knownIds(world)).length)).toBe(text)
})

Then('它又出現在錯題本裡', (world: PastWorld) => {
  expect(visibleWrongBook(world)).toContain(firstPast(world).question.id)
})

// 例外流程

const FIELDS: Record<string, keyof PastExam> = { 梯次: 'session', 考科: 'paper', 題號: 'number' }

Given(/^有一題考古題缺少(梯次|考科|題號)$/, (world: PastWorld, field) => {
  delete (firstPast(world).question.source.exams![0] as Partial<PastExam>)[FIELDS[field]]
  world.missing = field
})

Then('檢查失敗，並指出是哪一題、缺了什麼', (world: PastWorld) => {
  expect(world.errors).toContain(`${firstPast(world).question.id}：缺少${world.missing}`)
})

Then('網站維持上一版', (world: PastWorld) => {
  expect(world.errors.length).toBeGreaterThan(0)
})

Given(/^有一題考科是第一科的考古題，被放到「(L12) (.+)」的主題$/, (world: PastWorld, subjectId, title) => {
  world.base.subjects.push({
    id: subjectId,
    title,
    categories: [{ id: 'L122', title: '應用領域', concepts: [{ id: 'L12201', title: '工具使用', summary: '', keyPoints: [], questions: [] }] }],
  })
  world.past.push(pastItem('L12201', { session: '114-S4', paper: 1, number: 2 }))
  rebuild(world)
})

Then('檢查失敗，並指出這題的出處與被放到的主題', (world: PastWorld) => {
  const label = examLabel({ session: '114-S4', paper: 1, number: 2 })
  expect(world.errors.some((e) => e.includes(label) && e.includes('L12201'))).toBe(true)
})

Given('讀取私人題庫的金鑰失效', (world: PastWorld) => {
  world.past = []
})

When('執行部署', (world: PastWorld) => {
  world.errors = [privateBankError(world.past.length > 0)].filter((e) => e !== undefined)
})

Then(/^部署失敗，紀錄裡寫明「(.+)」$/, (world: PastWorld, text) => {
  expect(world.errors.some((e) => e.includes(text))).toBe(true)
})

Then('網站維持上一版，考古題照常可以練習', (world: PastWorld) => {
  // 部署失敗時 GitHub Pages 不會換掉線上的版本，所以上一版的考古題仍在
  expect(world.errors.length).toBeGreaterThan(0)
})

Given('公開 repo 的某個檔案或某次提交裡出現一題考古題的題目文字', (world: PastWorld) => {
  world.sources = [
    { name: 'README.md', text: '# 說明\n沒有考古題' },
    { name: 'docs/notes.md', text: `筆記：${firstPast(world).question.stem}` },
  ]
})

Then('檢查失敗，並指出是哪個檔案或哪次提交', (world: PastWorld) => {
  expect(world.errors).toEqual([`docs/notes.md：出現考古題 ${firstPast(world).question.id} 的題目文字`])
})

Given('兩個場次的同一題，官方公告答案的選項文字不一樣', (world: PastWorld) => {
  const copy = samePastQuestion(world, '115 年第二次 第一科 第 7 題')
  copy.question.answer = 'B'
})

Then('檢查失敗，並指出兩個出處，等作者人工確認', (world: PastWorld) => {
  const error = world.errors.find((e) => e.includes('人工確認'))
  expect(error).toContain('114 年第四次 第一科 第 1 題')
  expect(error).toContain('115 年第二次 第一科 第 7 題')
})

Given(/^有兩題考古題的出處都是 (.+)$/, (world: PastWorld, exam) => {
  const extra = pastItem(governance(world).id, parseExam(exam), '這是另一題測試用的假考古題，題目和第一題不一樣')
  extra.question.id = `${extra.question.id}-dup`
  world.past.push(extra)
})

Then('檢查失敗，並指出重複的出處', (world: PastWorld) => {
  expect(world.errors.some((e) => e.startsWith('出處重複：114 年第四次 第一科 第 1 題'))).toBe(true)
})
