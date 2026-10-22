// 作答紀錄、錯題本的格式、統計與匯出匯入，全部是純函式，方便測試

export interface Attempt {
  id?: number // IndexedDB 自動編號，匯出時不帶
  questionId: string
  conceptId: string
  choice: string
  correct: boolean
  answeredAt: string // ISO 8601
}

// 使用者確認把題目移出錯題本的紀錄；之後又答錯，題目會重新進入錯題本
export interface Dismissal {
  id?: number // IndexedDB 自動編號，匯出時不帶
  questionId: string
  dismissedAt: string // ISO 8601
}

export const DISMISS_PROMPT = '這題答對了，要從錯題本移除嗎？'

export const EXPORT_APP = 'ipas-topic-map'
// 版本 2 加入錯題本的移除紀錄；仍可匯入版本 1 的檔案
export const EXPORT_VERSION = 2

export interface ExportFile {
  app: typeof EXPORT_APP
  version: typeof EXPORT_VERSION
  exportedAt: string
  attempts: Omit<Attempt, 'id'>[]
  dismissals: Omit<Dismissal, 'id'>[]
}

export interface ImportedRecords {
  attempts: Omit<Attempt, 'id'>[]
  dismissals: Omit<Dismissal, 'id'>[]
}

// 每題最近一次的作答
export function latestByQuestion(attempts: Attempt[]) {
  const latest = new Map<string, Attempt>()
  for (const attempt of attempts) {
    const current = latest.get(attempt.questionId)
    if (!current || attempt.answeredAt >= current.answeredAt) latest.set(attempt.questionId, attempt)
  }
  return latest
}

// 錯題本：答錯過、而且最後一次答錯之後沒有被使用者移除的題目，最近答錯的排前面。
// 答對不會自動移出，要使用者確認（見 DISMISS_PROMPT）
export function wrongBook(attempts: readonly Attempt[], dismissals: readonly Dismissal[] = []) {
  const lastWrong = new Map<string, string>()
  for (const attempt of attempts) {
    if (attempt.correct) continue
    const current = lastWrong.get(attempt.questionId)
    if (!current || attempt.answeredAt > current) lastWrong.set(attempt.questionId, attempt.answeredAt)
  }
  const lastDismissed = new Map<string, string>()
  for (const dismissal of dismissals) {
    const current = lastDismissed.get(dismissal.questionId)
    if (!current || dismissal.dismissedAt > current) lastDismissed.set(dismissal.questionId, dismissal.dismissedAt)
  }
  return [...lastWrong]
    .filter(([questionId, wrongAt]) => {
      const dismissedAt = lastDismissed.get(questionId)
      return !dismissedAt || wrongAt > dismissedAt
    })
    .sort((a, b) => b[1].localeCompare(a[1]))
    .map(([questionId]) => questionId)
}

// 答對一題錯題本裡的題目時，要詢問使用者是否移除（在記下這次作答之前判斷）
export function shouldAskDismiss(
  questionId: string,
  correct: boolean,
  attempts: readonly Attempt[],
  dismissals: readonly Dismissal[],
) {
  return correct && wrongBook(attempts, dismissals).includes(questionId)
}

export function summary(attempts: Attempt[]) {
  const correct = attempts.filter((a) => a.correct).length
  return {
    total: attempts.length,
    correct,
    rate: attempts.length ? correct / attempts.length : 0,
  }
}

// 題目下架後作答紀錄仍保留（重新上架時接得回來），但統計只算網站上還有的題目
export function knownAttempts(attempts: readonly Attempt[], knownIds: ReadonlySet<string>) {
  return attempts.filter((a) => knownIds.has(a.questionId))
}

export function removedQuestionIds(attempts: readonly Attempt[], knownIds: ReadonlySet<string>) {
  return [...new Set(attempts.map((a) => a.questionId))].filter((id) => !knownIds.has(id))
}

export function removedNotice(count: number) {
  return `有 ${count} 題已下架，作答紀錄仍保留在你的瀏覽器`
}

export function toExport(attempts: Attempt[], dismissals: Dismissal[] = [], now = new Date()): ExportFile {
  return {
    app: EXPORT_APP,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    attempts: attempts.map(({ questionId, conceptId, choice, correct, answeredAt }) => ({
      questionId,
      conceptId,
      choice,
      correct,
      answeredAt,
    })),
    dismissals: dismissals.map(({ questionId, dismissedAt }) => ({ questionId, dismissedAt })),
  }
}

const isDate = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value))

function isAttempt(value: unknown): value is Omit<Attempt, 'id'> {
  if (typeof value !== 'object' || value === null) return false
  const a = value as Record<string, unknown>
  return (
    typeof a.questionId === 'string' &&
    typeof a.conceptId === 'string' &&
    typeof a.choice === 'string' &&
    typeof a.correct === 'boolean' &&
    isDate(a.answeredAt)
  )
}

function isDismissal(value: unknown): value is Omit<Dismissal, 'id'> {
  if (typeof value !== 'object' || value === null) return false
  const d = value as Record<string, unknown>
  return typeof d.questionId === 'string' && isDate(d.dismissedAt)
}

// 讀取匯出檔；格式不符時丟出可直接顯示給使用者的錯誤訊息
export function parseExport(text: string): ImportedRecords {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('檔案不是有效的 JSON。')
  }
  const file = data as { app?: unknown; version?: unknown; attempts?: unknown; dismissals?: unknown } | null
  if (!file || file.app !== EXPORT_APP) throw new Error('這不是本網站匯出的學習紀錄檔。')
  if (file.version !== 1 && file.version !== EXPORT_VERSION) {
    throw new Error(`不支援的紀錄檔版本：${String(file.version)}。`)
  }
  // 版本 1 沒有錯題本的移除紀錄
  const dismissals = file.version === 1 ? [] : file.dismissals
  if (
    !Array.isArray(file.attempts) ||
    !file.attempts.every(isAttempt) ||
    !Array.isArray(dismissals) ||
    !dismissals.every(isDismissal)
  ) {
    throw new Error('紀錄檔內容格式不正確。')
  }
  return {
    attempts: file.attempts.map(({ questionId, conceptId, choice, correct, answeredAt }) => ({
      questionId,
      conceptId,
      choice,
      correct,
      answeredAt,
    })),
    dismissals: dismissals.map(({ questionId, dismissedAt }) => ({ questionId, dismissedAt })),
  }
}

// 匯入時只留下還沒有的紀錄（同一題、同一個時間視為同一筆）
function onlyNew<T>(existing: readonly T[], incoming: readonly T[], key: (item: T) => string) {
  const seen = new Set(existing.map(key))
  const fresh: T[] = []
  for (const item of incoming) {
    const k = key(item)
    if (seen.has(k)) continue
    seen.add(k)
    fresh.push(item)
  }
  return fresh
}

export function newAttempts(existing: Omit<Attempt, 'id'>[], incoming: Omit<Attempt, 'id'>[]) {
  return onlyNew(existing, incoming, (a) => `${a.questionId}@${a.answeredAt}`)
}

export function newDismissals(existing: Omit<Dismissal, 'id'>[], incoming: Omit<Dismissal, 'id'>[]) {
  return onlyNew(existing, incoming, (d) => `${d.questionId}@${d.dismissedAt}`)
}

// 打開主題時停在哪一題（從 0 起算）：第一題還沒作答的；全部作答過就停在第一題最近答錯的；全部答對回到第 1 題。
// 需求在 tests/features/繼續作答.feature
export function resumeIndex(questionIds: string[], attempts: Attempt[]) {
  const latest = latestByQuestion(attempts)
  const unanswered = questionIds.findIndex((id) => !latest.has(id))
  if (unanswered >= 0) return unanswered
  return Math.max(questionIds.findIndex((id) => !latest.get(id)?.correct), 0)
}
