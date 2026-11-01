// 模擬考（需求在 tests/features/模擬考.feature）：把一個梯次的一科照官方題號從頭寫到尾，交卷才看分數。
// 考試時間與及格標準依 iPAS 官網與〈115 年度 AI 應用規劃師能力鑑定簡章（初、中級）〉
import type { Question, TopicMap } from '~/types/map'
import { practiceQuestions } from '~/utils/concepts'
import type { Attempt } from '~/utils/progress'
import { comparePapersNewestFirst, isPastPaper, PAPER_SIZE, PAPER_SUBJECT, paperLabel, paperName } from '~/utils/pastPapers'

// 初級每科 75 分鐘；剩 5 分鐘時提醒
export const EXAM_SECONDS = 75 * 60
export const WARN_SECONDS = 5 * 60
// 同時報考兩科：平均 70 分且每科不低於 60 分
export const PASS_AVERAGE = 70
export const PASS_EACH = 60

export const SUBMIT_CONFIRM = '確定交卷'
export const KEEP_GOING = '繼續作答'
export const LEAVE_PROMPT = '離開後這次作答不會保存，確定離開嗎？'
export const WARN_TEXT = '剩下 5 分鐘'
export const TIMED_OUT_TEXT = '時間到，已自動交卷'

export interface ExamItem {
  number: number
  question: Question
  conceptId: string
}

export interface ExamPaper {
  key: string
  session: string
  paper: 1 | 2
  subjectId: string
  title: string
  // 照官方題號排列；已下架的題目不在其中
  items: ExamItem[]
}

// 交卷後存在瀏覽器的成績（IndexedDB 的 exams），考卷清單與預估分數都由它算出
export interface ExamResult {
  id?: number // IndexedDB 自動編號，匯出時不帶
  session: string
  paper: 1 | 2
  score: number
  correct: number
  total: number
  durationSeconds: number
  timed: boolean
  timedOut: boolean
  submittedAt: string // ISO 8601
}

export interface ExamSession {
  paper: ExamPaper
  timed: boolean
  startedAt: number // 毫秒
  // 題號 → 選的答案
  answers: Map<number, string>
}

// 網站上所有考卷：依考科分成第一科（L11）、第二科（L12），梯次由新到舊
export function examPapers(map: TopicMap): ExamPaper[] {
  const papers = new Map<string, ExamPaper>()
  for (const subject of map.subjects) {
    for (const category of subject.categories) {
      for (const concept of category.concepts) {
        for (const question of practiceQuestions(concept)) {
          if (!isPastPaper(question)) continue
          // 同一題在不同場次考過時，每一份考卷都有它
          for (const exam of question.source.exams ?? []) {
            const key = `${exam.session}-${exam.paper}`
            let paper = papers.get(key)
            if (!paper) {
              paper = {
                key,
                session: exam.session,
                paper: exam.paper,
                subjectId: PAPER_SUBJECT[exam.paper],
                title: paperLabel(exam.session, exam.paper),
                items: [],
              }
              papers.set(key, paper)
            }
            paper.items.push({ number: exam.number, question, conceptId: concept.id })
          }
        }
      }
    }
  }
  for (const paper of papers.values()) paper.items.sort((a, b) => a.number - b.number)
  return [...papers.values()].sort((a, b) => a.paper - b.paper || comparePapersNewestFirst(a, b))
}

// 已下架幾題：一科本來 50 題
export function removedText(paper: ExamPaper) {
  const removed = Math.max(PAPER_SIZE - paper.items.length, 0)
  return removed ? `這份考卷有 ${removed} 題已下架，分數只算 ${paper.items.length} 題` : undefined
}

export function startExam(paper: ExamPaper, timed: boolean, now: number): ExamSession {
  return { paper, timed, startedAt: now, answers: new Map() }
}

function elapsedSeconds(session: ExamSession, now: number) {
  return Math.max(Math.floor((now - session.startedAt) / 1000), 0)
}

// 不計時時沒有剩餘時間
export function remainingSeconds(session: ExamSession, now: number) {
  if (!session.timed) return undefined
  return Math.max(EXAM_SECONDS - elapsedSeconds(session, now), 0)
}

// 「75:00」
export function clockText(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 還有題目沒作答就交卷時要先確認；全部作答過就直接交卷
export function submitPrompt(session: ExamSession) {
  const left = session.paper.items.filter((item) => !session.answers.has(item.number)).length
  return left ? `還有 ${left} 題沒作答，確定交卷嗎？` : undefined
}

export interface WrongAnswer {
  number: number
  question: Question
  // 沒作答時是 undefined
  choice?: string
}

export interface ExamOutcome {
  result: ExamResult
  wrong: WrongAnswer[]
  // 有作答的題目才記成作答紀錄（進複習清單、算城鎮等級），沒作答的不記
  attempts: Omit<Attempt, 'id'>[]
}

// 交卷：沒作答的算錯；分數是答對率換成 100 分，四捨五入取整數
export function gradeExam(session: ExamSession, now: number, timedOut = false): ExamOutcome {
  const submittedAt = new Date(now).toISOString()
  const wrong: WrongAnswer[] = []
  const attempts: Omit<Attempt, 'id'>[] = []
  let correct = 0
  for (const { number, question, conceptId } of session.paper.items) {
    const choice = session.answers.get(number)
    const right = choice === question.answer
    if (right) correct += 1
    else wrong.push({ number, question, choice })
    if (choice !== undefined) attempts.push({ questionId: question.id, conceptId, choice, correct: right, answeredAt: submittedAt })
  }
  const total = session.paper.items.length
  const durationSeconds = session.timed ? Math.min(elapsedSeconds(session, now), EXAM_SECONDS) : elapsedSeconds(session, now)
  return {
    result: {
      session: session.paper.session,
      paper: session.paper.paper,
      score: total ? Math.round((correct / total) * 100) : 0,
      correct,
      total,
      durationSeconds,
      timed: session.timed,
      timedOut,
      submittedAt,
    },
    wrong,
    attempts,
  }
}

export function scoreText(result: ExamResult) {
  return `${result.score} 分`
}

export function correctText(result: ExamResult) {
  return `答對 ${result.correct}／${result.total}`
}

// 「用時 52:30／75:00」；不計時就只寫用了多久
export function durationText(result: ExamResult) {
  const used = clockText(result.durationSeconds)
  return result.timed ? `用時 ${used}／${clockText(EXAM_SECONDS)}` : `用時 ${used}`
}

// 考卷清單上的文字：「還沒考過」「最近 78 分・考過 2 次」
export function paperStatusText(results: readonly ExamResult[], session: string, paper: number) {
  const mine = results.filter((r) => r.session === session && r.paper === paper)
  if (!mine.length) return '還沒考過'
  const latest = mine.reduce((a, b) => (b.submittedAt > a.submittedAt ? b : a))
  return `最近 ${latest.score} 分・考過 ${mine.length} 次`
}

// 各科最近一次模擬考的分數（不分梯次）
function latestScores(results: readonly ExamResult[]) {
  const latest = new Map<number, ExamResult>()
  for (const result of results) {
    const current = latest.get(result.paper)
    if (!current || result.submittedAt > current.submittedAt) latest.set(result.paper, result)
  }
  return latest
}

// 預估會不會過：用兩科各自最近一次的模擬考分數，依「平均 70 分且每科不低於 60 分」判斷
export function predictionText(results: readonly ExamResult[]) {
  const latest = latestScores(results)
  const first = latest.get(1)?.score
  const second = latest.get(2)?.score
  if (first === undefined && second === undefined) return undefined
  if (first === undefined) return `預估：第二科 ${second}・第一科還沒考過模擬考`
  if (second === undefined) return `預估：第一科 ${first}・第二科還沒考過模擬考`
  const average = Math.round((first + second) / 2)
  const low = [first, second]
    .map((score, i) => (score < PASS_EACH ? paperName(i + 1) : undefined))
    .filter((name): name is string => Boolean(name))
  const verdict = low.length
    ? `${low.join('、')}低於 ${PASS_EACH} 分`
    : average < PASS_AVERAGE
      ? `平均未達 ${PASS_AVERAGE} 分`
      : '達到合格標準'
  return `預估：第一科 ${first}・第二科 ${second}・平均 ${average}，${verdict}`
}

// 考卷清單分成「L11 第一科」「L12 第二科」兩組
export function examGroups(papers: readonly ExamPaper[]) {
  return ([1, 2] as const)
    .map((paper) => ({
      paper,
      title: `${PAPER_SUBJECT[paper]} ${paperName(paper)}`,
      papers: papers.filter((p) => p.paper === paper),
    }))
    .filter((group) => group.papers.length)
}

// 剩 5 分鐘（含）以內、還沒到時間時提醒
export function timeWarning(session: ExamSession, now: number) {
  const left = remainingSeconds(session, now)
  return left !== undefined && left > 0 && left <= WARN_SECONDS ? WARN_TEXT : undefined
}

export function isTimeUp(session: ExamSession, now: number) {
  return remainingSeconds(session, now) === 0
}
