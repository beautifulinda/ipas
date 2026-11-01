// 〈模擬考〉的步驟定義
import { Given, Then, When } from 'quickpickle'
import { expect } from 'vitest'
import type { Concept, PastExam, Question, TopicMap } from '~/types/map'
import {
  EXAM_CELEBRATES,
  LEAVE_PROMPT,
  TIMED_OUT_TEXT,
  clockText,
  correctText,
  durationText,
  examGroups,
  examPapers,
  gradeExam,
  isTimeUp,
  paperStatusText,
  predictionText,
  remainingSeconds,
  removedText,
  scoreText,
  startExam,
  submitPrompt,
  timeWarning,
  type ExamOutcome,
  type ExamPaper,
  type ExamResult,
  type ExamSession,
} from '~/utils/mockExam'
import { paperLabel } from '~/utils/pastPapers'
import { computeProgression } from '~/utils/progression'
import { wrongBook } from '~/utils/progress'
import { question } from '../unit/fixtures'
import type { World } from './world'

interface ExamWorld extends World {
  results: ExamResult[]
  session?: ExamSession
  outcome?: ExamOutcome
  // 畫面上的文字：剩餘時間的提醒；不計時的選擇
  warning?: string
  untimed?: boolean
  // 現在時間（毫秒），計時用
  now: number
}

// 假題庫：L11 有 115-S3 第一科；L12 有 115-S3、115-S2 第二科，分在兩個主題（第 1～25 題、第 26～50 題）
// 題目內容一律是假的，正確答案都是 A
function past(session: string, paper: 1 | 2, number: number): Question {
  const exams: PastExam[] = [{ session, paper, number }]
  return {
    ...question(`${session}-${paper}-${number}`),
    options: ['A', 'B', 'C', 'D'].map((id) => ({ id, text: `選項 ${id}` })),
    source: { type: 'official-past', exams },
  }
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
const pastConcept = (id: string, questions: Question[]): Concept => ({ id, title: id, summary: '', keyPoints: [], questions })

function examMap(): TopicMap {
  const l12 = (numbers: number[]) => [...numbers.map((n) => past('115-S3', 2, n)), ...numbers.map((n) => past('115-S2', 2, n))]
  return {
    version: '1',
    updatedAt: '2026-11-01',
    disclaimer: '',
    subjects: [
      {
        id: 'L11',
        title: '人工智慧基礎概論',
        categories: [{ id: 'L111', title: '地區一', concepts: [pastConcept('L11 主題', range(1, 50).map((n) => past('115-S3', 1, n)))] }],
      },
      {
        id: 'L12',
        title: '生成式 AI 應用與規劃',
        categories: [
          {
            id: 'L121',
            title: '地區二',
            concepts: [pastConcept('L12 主題甲', l12(range(1, 25))), pastConcept('L12 主題乙', l12(range(26, 50)))],
          },
        ],
      },
    ],
  }
}

function papers(world: ExamWorld) {
  return examPapers(world.map)
}

function findPaper(world: ExamWorld, title: string): ExamPaper {
  const found = papers(world).find((p) => p.title === title)
  if (!found) throw new Error(`題庫裡沒有考卷「${title}」`)
  return found
}

function begin(world: ExamWorld, title: string, timed = true) {
  world.session = startExam(findPaper(world, title), timed, world.now)
  world.outcome = undefined
  world.prompt = undefined
}

// 依序作答前 count 題，其中前 correct 題答對（選 A），其餘答錯（選 B）
function answerFirst(world: ExamWorld, count: number, correct: number) {
  for (const item of world.session!.paper.items.slice(0, count)) {
    world.session!.answers.set(item.number, item.number <= correct ? 'A' : 'B')
  }
}

// 和畫面相同：交卷後記下作答紀錄與成績；交卷後不放升級演出
function submit(world: ExamWorld, timedOut = false) {
  world.outcome = gradeExam(world.session!, world.now, timedOut)
  world.attempts.push(...world.outcome.attempts)
  world.results.push(world.outcome.result)
  world.plan = undefined
  world.session = undefined
  world.prompt = undefined
}

function pressSubmit(world: ExamWorld) {
  const text = submitPrompt(world.session!)
  if (text) world.prompt = { text, questionId: '' }
  else submit(world)
}

Given(/^題庫有 115 年第三次 第一科、第二科，和 115 年第二次 第二科的考古題，每份 50 題$/, (world: ExamWorld) => {
  world.map = examMap()
  world.attempts = []
  world.dismissals = []
  world.marks = []
  world.results = []
  world.session = undefined
  world.outcome = undefined
  world.prompt = undefined
  world.plan = undefined
  world.milestones = []
  world.warning = undefined
  world.untimed = undefined
  world.now = Date.UTC(2026, 10, 1, 13, 30)
})

When('我打開「學習紀錄」的「模擬考」', () => {}, 1)

Then(/^考卷依科目分成「(.+)」「(.+)」，梯次由新到舊排列$/, (world: ExamWorld, first, second) => {
  const groups = examGroups(papers(world))
  expect(groups.map((g) => g.title)).toEqual([first, second])
  expect(groups[1].papers.map((p) => p.title)).toEqual([paperLabel('115-S3', 2), paperLabel('115-S2', 2)])
})

Then(/^考卷「(.+)」(?:仍然)?顯示「(.+)」$/, (world: ExamWorld, title, text) => {
  const paper = findPaper(world, title)
  expect(paperStatusText(world.results, paper.session, paper.paper)).toBe(text)
})

When(/^我點「(.+ 第.科)」$/, (world: ExamWorld, title) => {
  begin(world, title)
})

Then(/^畫面顯示第 1 題，題號 1～50 照官方題號排列$/, (world: ExamWorld) => {
  expect(world.session!.paper.items.map((item) => item.number)).toEqual(range(1, 50))
})

Given(/^我正在考「([^」]+)」$/, (world: ExamWorld, title) => {
  begin(world, title)
})

Given(/^我正在考「([^」]+)」，作答了 (\d+) 題$/, (world: ExamWorld, title, count) => {
  begin(world, title)
  answerFirst(world, Number(count), Number(count))
})

Given(/^我正在考「([^」]+)」，作答了 (\d+) 題，答對 (\d+) 題$/, (world: ExamWorld, title, count, correct) => {
  begin(world, title)
  answerFirst(world, Number(count), Number(correct))
})

Given(/^我正在考「([^」]+)」，還有 (\d+) 題沒作答$/, (world: ExamWorld, title, left) => {
  begin(world, title)
  answerFirst(world, 50 - Number(left), 50 - Number(left))
})

Given(/^我正在考「([^」]+)」，剩餘時間到「(\d+):(\d+)」$/, (world: ExamWorld, title, m, s) => {
  begin(world, title)
  world.now += (75 * 60 - (Number(m) * 60 + Number(s))) * 1000
  world.warning = timeWarning(world.session!, world.now)
})

When(/^我在第 (\d+) 題選 (.)，再改選 (.)$/, (world: ExamWorld, n, first, second) => {
  world.session!.answers.set(Number(n), first)
  world.session!.answers.set(Number(n), second)
})

Then('畫面不顯示這題答對或答錯', (world: ExamWorld) => {
  expect(world.outcome).toBeUndefined()
  expect(world.session!.answers.get(1)).toBe('C')
})

Then(/^題號 (\d+) 標示為已作答$/, (world: ExamWorld, n) => {
  expect(world.session!.answers.has(Number(n))).toBe(true)
})

Given(/^我 50 題都作答了，答對 (\d+) 題$/, (world: ExamWorld, correct) => {
  answerFirst(world, 50, Number(correct))
})

Given(/^我作答了 (\d+) 題，答對 (\d+) 題$/, (world: ExamWorld, count, correct) => {
  answerFirst(world, Number(count), Number(correct))
})

When('我按「交卷」', (world: ExamWorld) => {
  pressSubmit(world)
})

When('我按「交卷」，再選「繼續作答」', (world: ExamWorld) => {
  pressSubmit(world)
  expect(world.prompt).toBeDefined()
  world.prompt = undefined
})

When('我選「確定交卷」', (world: ExamWorld) => {
  submit(world)
})

Then(/^畫面顯示「(\d+ 分)」與「(答對 .+)」$/, (world: ExamWorld, score, correct) => {
  expect(scoreText(world.outcome!.result)).toBe(score)
  expect(correctText(world.outcome!.result)).toBe(correct)
})

Then(/^列出答錯的 (\d+) 題，每題顯示我的答案和官方答案$/, (world: ExamWorld, count) => {
  expect(world.outcome!.wrong).toHaveLength(Number(count))
  for (const item of world.outcome!.wrong) {
    expect(item.choice).toBe('B')
    expect(item.question.answer).toBe('A')
  }
})

Then('畫面回到考卷，已作答的答案都還在', (world: ExamWorld) => {
  expect(world.prompt).toBeUndefined()
  expect(world.outcome).toBeUndefined()
  expect(world.session!.answers.size).toBe(45)
})

Given(/^我考完「([^」]+)」，答錯第 (\d+) 題、沒作答第 (\d+) 題$/, (world: ExamWorld, title, wrong, skipped) => {
  begin(world, title)
  for (const item of world.session!.paper.items) {
    if (item.number === Number(skipped)) continue
    world.session!.answers.set(item.number, item.number === Number(wrong) ? 'B' : 'A')
  }
  submit(world)
})

function questionAt(world: ExamWorld, n: number) {
  const paper = findPaper(world, paperLabel(world.outcome!.result.session, world.outcome!.result.paper))
  return paper.items.find((item) => item.number === n)!
}

Then(/^第 (\d+) 題進入複習清單$/, (world: ExamWorld, n) => {
  expect(wrongBook(world.attempts, world.dismissals)).toContain(questionAt(world, Number(n)).question.id)
})

Then(/^第 (\d+) 題所在主題的城鎮等級照新的作答紀錄計算$/, (world: ExamWorld, n) => {
  const { conceptId } = questionAt(world, Number(n))
  // 主題甲有 115-S3、115-S2 各 25 題；考完 115-S3 答對 24 題、答錯 1 題
  expect(computeProgression(world.map, world.attempts).townProgress.get(conceptId)).toMatchObject({ correct: 24, wrong: 1, total: 50 })
})

Then(/^第 (\d+) 題沒有作答紀錄$/, (world: ExamWorld, n) => {
  const id = questionAt(world, Number(n)).question.id
  expect(world.attempts.some((a) => a.questionId === id)).toBe(false)
})

Then('交卷後不放升級煙火與升級卡', (world: ExamWorld) => {
  expect(EXAM_CELEBRATES).toBe(false)
  expect(world.plan).toBeUndefined()
})

When('我按「離開」', (world: ExamWorld) => {
  world.prompt = { text: LEAVE_PROMPT, questionId: '' }
})

When('我選「確定離開」', (world: ExamWorld) => {
  world.session = undefined
  world.prompt = undefined
})

Then('沒有新增任何作答紀錄', (world: ExamWorld) => {
  expect(world.attempts).toEqual([])
  expect(world.results).toEqual([])
})

function result(session: string, paper: 1 | 2, score: number, at: number): ExamResult {
  return {
    session,
    paper,
    score,
    correct: score / 2,
    total: 50,
    durationSeconds: 3600,
    timed: true,
    timedOut: false,
    submittedAt: new Date(Date.UTC(2026, 9, at)).toISOString(),
  }
}

Given(/^我考過「([^」]+)」兩次，先 (\d+) 分、後來 (\d+) 分$/, (world: ExamWorld, title, first, second) => {
  const paper = findPaper(world, title)
  world.results.push(result(paper.session, paper.paper, Number(first), 1), result(paper.session, paper.paper, Number(second), 2))
})

Given(/^第一科最近一次模擬考 (\d+) 分，第二科最近一次 (\d+) 分$/, (world: ExamWorld, first, second) => {
  world.results.push(result('115-S3', 1, Number(first), 3), result('115-S3', 2, Number(second), 4))
})

Given(/^第一科最近一次模擬考 (\d+) 分，第二科沒有考過$/, (world: ExamWorld, first) => {
  world.results.push(result('115-S3', 1, Number(first), 3))
})

Then(/^畫面顯示「(預估：.+)」$/, (world: ExamWorld, text) => {
  expect(predictionText(world.results)).toBe(text)
})

Given(/^「([^」]+)」有 (\d+) 題已下架$/, (world: ExamWorld, title, count) => {
  const ids = new Set(findPaper(world, title).items.slice(-Number(count)).map((item) => item.question.id))
  for (const concept of world.map.subjects.flatMap((s) => s.categories.flatMap((c) => c.concepts))) {
    concept.questions = concept.questions.filter((q) => !ids.has(q.id))
  }
})

When(/^我考完「([^」]+)」，答對 (\d+) 題$/, (world: ExamWorld, title, correct) => {
  begin(world, title)
  answerFirst(world, world.session!.paper.items.length, Number(correct))
  pressSubmit(world)
})

Then(/^顯示「(這份考卷有 .+)」$/, (world: ExamWorld, text) => {
  expect(removedText(findPaper(world, paperLabel(world.outcome!.result.session, world.outcome!.result.paper)))).toBe(text)
})

// 計時
When(/^我開始考「([^」]+)」$/, (world: ExamWorld, title) => {
  begin(world, title, !world.untimed)
})

When(/^我選「不計時」再開始考「([^」]+)」$/, (world: ExamWorld, title) => {
  world.untimed = true
  begin(world, title, false)
})

Then(/^畫面顯示剩餘時間「(.+)」並開始倒數$/, (world: ExamWorld, text) => {
  expect(clockText(remainingSeconds(world.session!, world.now)!)).toBe(text)
  expect(clockText(remainingSeconds(world.session!, world.now + 1000)!)).toBe('74:59')
})

Then('畫面不顯示剩餘時間', (world: ExamWorld) => {
  expect(remainingSeconds(world.session!, world.now)).toBeUndefined()
})

Then(/^畫面提醒「(.+)」，報讀軟體也會唸出$/, (world: ExamWorld, text) => {
  expect(world.warning).toBe(text)
  // 還沒到 5 分鐘前不提醒
  expect(timeWarning(world.session!, world.now - 1000)).toBeUndefined()
})

When('剩餘時間到「00:00」', (world: ExamWorld) => {
  world.now = world.session!.startedAt + 75 * 60 * 1000
  if (isTimeUp(world.session!, world.now)) submit(world, true)
})

Then('不詢問就直接交卷', (world: ExamWorld) => {
  expect(world.prompt).toBeUndefined()
  expect(world.outcome).toBeDefined()
})

Then(/^顯示「(時間到.+)」$/, (world: ExamWorld, text) => {
  expect(world.outcome!.result.timedOut).toBe(true)
  expect(TIMED_OUT_TEXT).toBe(text)
})

Given(/^我在 (\d+) 分 (\d+) 秒時交卷$/, (world: ExamWorld, m, s) => {
  begin(world, paperLabel('115-S3', 2))
  answerFirst(world, 50, 40)
  world.now += (Number(m) * 60 + Number(s)) * 1000
  submit(world)
})

Then(/^成績畫面顯示「(用時 .+)」$/, (world: ExamWorld, text) => {
  expect(durationText(world.outcome!.result)).toBe(text)
})
