// 官方公告試題（考古題）：出處的顯示、同一題的合併、部署前的檢查
// scripts/validate-data.mjs 也會直接載入這個檔案（Node 的型別移除），所以這裡只能 import type
import type { Concept, PastExam, Question, TopicMap } from '~/types/map'

export interface PastPaperItem {
  conceptId: string
  question: Question
}

// 全站共用的官網連結：iPAS 學習資源頁，「歷屆考題」下有初級能力鑑定試題公告
export const PAST_PAPERS_URL = 'https://ipd.nat.gov.tw/ipas/certification/AIAP/learning-resources'
export const PAST_PAPERS_LINK_TEXT = 'iPAS 官網學習資源'
export const COPYRIGHT_NOTICE = '試題著作權屬經濟部產業人才能力鑑定（iPAS），僅供個人學習練習，不得重製或作為營利用途'
export const NO_EXPLANATION = '答案依 iPAS 官方公告'
export const PRIVATE_BANK_MISSING = '讀不到私人題庫'
// 考科對應的島：第一科＝L11 人工智慧基礎概論、第二科＝L12 生成式 AI 應用與規劃
export const PAPER_SUBJECT: Record<number, string> = { 1: 'L11', 2: 'L12' }

const DIGITS = '〇一二三四五六七八九'

function chineseNumber(n: number) {
  if (n <= 10) return n === 10 ? '十' : DIGITS[n]
  if (n < 20) return `十${DIGITS[n % 10]}`
  return `${DIGITS[Math.floor(n / 10)]}十${n % 10 ? DIGITS[n % 10] : ''}`
}

function parseSession(session: string) {
  const match = /^(\d{3})-S(\d{1,2})$/.exec(session)
  return match ? { year: Number(match[1]), round: Number(match[2]) } : undefined
}

// "114-S4" → "114 年第四次"
export function sessionLabel(session: string) {
  const parsed = parseSession(session)
  return parsed ? `${parsed.year} 年第${chineseNumber(parsed.round)}次` : session
}

export function examLabel(exam: PastExam) {
  return `${sessionLabel(exam.session)} 第${chineseNumber(exam.paper)}科 第 ${exam.number} 題`
}

// 依梯次、考科、題號由舊到新排序
export function compareExams(a: PastExam, b: PastExam) {
  const sa = parseSession(a.session)
  const sb = parseSession(b.session)
  return (sa?.year ?? 0) - (sb?.year ?? 0) || (sa?.round ?? 0) - (sb?.round ?? 0) || a.paper - b.paper || a.number - b.number
}

const examsOf = (question: Question) => question.source.exams ?? []
const latestExam = (question: Question) => [...examsOf(question)].sort(compareExams).at(-1)

export function isPastPaper(question: Question) {
  return question.source.type === 'official-past'
}

export function sourceBadge(question: Question) {
  if (isPastPaper(question)) return '官方公告試題'
  if (question.source.type === 'official-link') return '官方樣題（連結）'
  return '自編題'
}

// 「出處：114 年第四次 第一科 第 1 題、115 年第二次 第一科 第 7 題（考過 2 次）」
export function sourceLabel(question: Question) {
  const exams = [...examsOf(question)].sort(compareExams)
  if (!isPastPaper(question) || !exams.length) return undefined
  const times = exams.length > 1 ? `（考過 ${exams.length} 次）` : ''
  return `出處：${exams.map(examLabel).join('、')}${times}`
}

export function explanationText(question: Question) {
  return question.explanation || (isPastPaper(question) ? NO_EXPLANATION : '')
}

export function verdictText(question: Question, correct: boolean) {
  return correct ? '答對了！' : `答錯了，正確答案是 ${question.answer}。`
}

// 同一個主題裡，考古題依最近一次考的梯次由新到舊，自編題排在最後（維持原本順序）
export function sortForPractice(questions: Question[]) {
  const past = questions.filter(isPastPaper)
  const others = questions.filter((q) => !isPastPaper(q))
  past.sort((a, b) => compareExams(latestExam(b)!, latestExam(a)!))
  return [...past, ...others]
}

// 判斷「同一題」時忽略標點、空白、全形半形與選項順序
export function normalizeText(text: string) {
  return text.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase()
}

function sameQuestionKey(question: Question) {
  const options = question.options.map((o) => normalizeText(o.text)).sort()
  return [normalizeText(question.stem), ...options].join('|')
}

// 答案比對的是選項文字，不是 A、B、C、D（同一題在不同場次的選項順序可能不同）
function answerText(question: Question) {
  return normalizeText(question.options.find((o) => o.id === question.answer)?.text ?? '')
}

// 同一題在不同場次考過時合併成一題：沿用最早那次的題目與 ID（作答紀錄才接得上），出處列出每一次
export function mergePastPapers(items: PastPaperItem[]) {
  const groups = new Map<string, PastPaperItem[]>()
  for (const item of items) {
    const key = sameQuestionKey(item.question)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  const merged: PastPaperItem[] = []
  const errors: string[] = []
  const earliest = (item: PastPaperItem) => [...examsOf(item.question)].sort(compareExams)[0]
  for (const group of groups.values()) {
    group.sort((a, b) => {
      const ea = earliest(a)
      const eb = earliest(b)
      return ea && eb ? compareExams(ea, eb) : 0
    })
    const [first] = group
    if (group.length === 1) {
      merged.push(first)
      continue
    }
    const exams = group.flatMap((item) => examsOf(item.question)).sort(compareExams)
    if (new Set(group.map((item) => answerText(item.question))).size > 1) {
      const where = group.map((item) => examLabel(earliest(item)!)).join('、')
      errors.push(`${where} 是同一題，但官方公告的答案不一樣，請人工確認`)
    }
    merged.push({ ...first, question: { ...first.question, source: { ...first.question.source, exams } } })
  }
  return { items: merged, errors }
}

function subjectOf(map: TopicMap, conceptId: string) {
  for (const subject of map.subjects) {
    for (const category of subject.categories) {
      const concept = category.concepts.find((c) => c.id === conceptId)
      if (concept) return { subjectId: subject.id, concept }
    }
  }
}

const describe = (concept: Concept) => `「${concept.id} ${concept.title}」`

// 部署前的檢查：出處完整、考科和島對得上、同一個出處只登錄一次、同一題的答案一致
export function checkPastPapers(items: PastPaperItem[], map: TopicMap) {
  const errors: string[] = []
  const seen = new Map<string, string>()
  for (const { conceptId, question } of items) {
    const id = question.id
    const exams = examsOf(question)
    if (!exams.length) errors.push(`${id}：缺少出處`)
    for (const exam of exams) {
      if (!exam.session) errors.push(`${id}：缺少梯次`)
      else if (!parseSession(exam.session)) errors.push(`${id}：梯次格式應為「114-S4」，目前是「${exam.session}」`)
      if (!exam.paper) errors.push(`${id}：缺少考科`)
      else if (!PAPER_SUBJECT[exam.paper]) errors.push(`${id}：考科只能是 1 或 2，目前是 ${exam.paper}`)
      if (!exam.number) errors.push(`${id}：缺少題號`)
      if (!exam.session || !exam.paper || !exam.number) continue
      const label = examLabel(exam)
      if (seen.has(label)) errors.push(`出處重複：${label}（${seen.get(label)}、${id}）`)
      else seen.set(label, id)
      const owner = subjectOf(map, conceptId)
      const expected = PAPER_SUBJECT[exam.paper]
      if (owner && expected && owner.subjectId !== expected) {
        errors.push(`${id}：${label}的考科對應 ${expected}，但被放到 ${owner.subjectId} 的主題${describe(owner.concept)}`)
      }
    }
  }
  return [...errors, ...mergePastPapers(items).errors]
}

// 公開 repo 的檔案與提交裡，不可出現考古題的題目文字；太短的題目容易誤判，不比對
export function findLeaks(sources: { name: string; text: string }[], items: PastPaperItem[], minLength = 15) {
  const stems = items
    .map((item) => ({ id: item.question.id, stem: normalizeText(item.question.stem) }))
    .filter((item) => item.stem.length >= minLength)
  const errors: string[] = []
  for (const source of sources) {
    const text = normalizeText(source.text)
    const hit = stems.find((item) => text.includes(item.stem))
    if (hit) errors.push(`${source.name}：出現考古題 ${hit.id} 的題目文字`)
  }
  return errors
}

export function privateBankError(exists: boolean) {
  return exists ? undefined : `${PRIVATE_BANK_MISSING}：請確認部署金鑰 PAST_PAPERS_DEPLOY_KEY 仍有效`
}
