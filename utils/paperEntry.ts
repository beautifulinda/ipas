// 梯次入口（需求在 tests/features/梯次入口.feature）：打開網站先列出每一次考試，左邊第一科、右邊第二科；
// 選一份考卷後，地圖上的題目、進度圓餅、「從這裡開始」「下一站」只算這一份，城鎮等級仍照全部題目算
import type { TopicMap } from '~/types/map'
import { examPapers, type ExamPaper } from '~/utils/mockExam'
import { comparePapersNewestFirst, PAPER_SUBJECT, paperLabel, sessionLabel } from '~/utils/pastPapers'
import { latestByQuestion, type Attempt } from '~/utils/progress'
import { computeProgression, type Progression } from '~/utils/progression'

// 網址 ?paper= 的值：「115-S3-2」是 115 年第三次 第二科；「all」是全部梯次
export const ALL_PAPERS = 'all'

export interface PaperChoice {
  session: string
  paper: 1 | 2
}

export const ENTRY_ALL_TEXT = '看全部主題（不分梯次）'
export const NO_PAST_PAPERS = '目前沒有考古題'
export const PAPER_MISSING = '目前沒有這份考古題'
export const NOT_STARTED = '還沒開始'
export const SHOW_ALL_PAPERS = '看全部梯次'
export const BACK_TO_ENTRY = '回梯次列表'
export const SHOW_ALL_QUESTIONS = '看全部梯次的題目'

export function paperParam(choice: PaperChoice) {
  return `${choice.session}-${choice.paper}`
}

export function parsePaperParam(value: unknown): PaperChoice | undefined {
  if (typeof value !== 'string') return undefined
  const match = /^(\d{3}-S\d{1,2})-([12])$/.exec(value)
  return match ? { session: match[1], paper: Number(match[2]) as 1 | 2 } : undefined
}

export function choiceLabel(choice: PaperChoice) {
  return paperLabel(choice.session, choice.paper)
}

// 「目前：115 年第三次 第二科」
export function currentPaperText(choice: PaperChoice) {
  return `目前：${choiceLabel(choice)}`
}

// 「115 年第三次 第二科沒有考這個主題」
export function notInPaperText(choice: PaperChoice) {
  return `${choiceLabel(choice)}沒有考這個主題`
}

// 選了考卷後要對準的島：第一科＝L11、第二科＝L12
export function paperSubject(choice: PaperChoice) {
  return PAPER_SUBJECT[choice.paper]
}

export interface EntryCell {
  paper: ExamPaper
  answered: number
  correct: number
  // 網站上還有的題數；有題目下架時少於 50
  total: number
}

export interface EntryRow {
  session: string
  title: string
  // [第一科, 第二科]；沒有這份考古題時是 undefined
  papers: [EntryCell | undefined, EntryCell | undefined]
}

function cellFor(paper: ExamPaper, latest: Map<string, Attempt>): EntryCell {
  const answered = paper.items.filter((item) => latest.has(item.question.id))
  return {
    paper,
    answered: answered.length,
    correct: answered.filter((item) => latest.get(item.question.id)?.correct).length,
    total: paper.items.length,
  }
}

// 入口的梯次列表，由新到舊
export function entryRows(map: TopicMap, attempts: readonly Attempt[]): EntryRow[] {
  const latest = latestByQuestion([...attempts])
  const rows = new Map<string, EntryRow>()
  for (const paper of examPapers(map)) {
    let row = rows.get(paper.session)
    if (!row) {
      row = { session: paper.session, title: sessionLabel(paper.session), papers: [undefined, undefined] }
      rows.set(paper.session, row)
    }
    row.papers[paper.paper - 1] = cellFor(paper, latest)
  }
  return [...rows.values()].sort((a, b) => comparePapersNewestFirst({ session: a.session, paper: 1 }, { session: b.session, paper: 1 }))
}

// 「已作答 12／50・答對 9」；還沒作答時是「還沒開始」
export function cellText(cell: EntryCell) {
  return cell.answered ? `已作答 ${cell.answered}／${cell.total}・答對 ${cell.correct}` : NOT_STARTED
}

// 報讀軟體唸的完整名稱：「115 年第三次 第二科，已作答 12／50，答對 9」
export function cellLabel(cell: EntryCell) {
  const label = paperLabel(cell.paper.session, cell.paper.paper)
  return cell.answered ? `${label}，已作答 ${cell.answered}／${cell.total}，答對 ${cell.correct}` : `${label}，${NOT_STARTED}`
}

// 只留下這份考卷的題目；主題都保留（題目變成空的），地圖版面才不會變
// 同一題在不同梯次考過時，每個梯次都有它；自編題不屬於任何一次考試，選了考卷就不出現
export function filterMapByPaper(map: TopicMap, choice: PaperChoice): TopicMap {
  const inPaper = (exams: { session: string; paper: number }[] = []) =>
    exams.some((exam) => exam.session === choice.session && exam.paper === choice.paper)
  return {
    ...map,
    subjects: map.subjects.map((subject) => ({
      ...subject,
      categories: subject.categories.map((category) => ({
        ...category,
        concepts: category.concepts.map((concept) => ({
          ...concept,
          questions: concept.questions.filter((q) => q.source.type === 'official-past' && inPaper(q.source.exams)),
        })),
      })),
    })),
  }
}

// 選了考卷時地圖用的熟練度：進度圓餅、題數、有沒有練習過（「從這裡開始」「下一站」）只算這份考卷，
// 城鎮等級、雲霧、旗子、燈塔沿用全部題目算出的結果，換考卷時建築不會忽大忽小
export function paperProgression(full: Progression, paperMap: TopicMap, attempts: readonly Attempt[]): Progression {
  const own = computeProgression(paperMap, attempts)
  return { ...full, townProgress: own.townProgress, practicedTowns: own.practicedTowns }
}
