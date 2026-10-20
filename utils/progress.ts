// 作答紀錄的格式、統計與匯出匯入，全部是純函式，方便測試

export interface Attempt {
  id?: number // IndexedDB 自動編號，匯出時不帶
  questionId: string
  conceptId: string
  choice: string
  correct: boolean
  answeredAt: string // ISO 8601
}

export const EXPORT_APP = 'ipas-topic-map'
export const EXPORT_VERSION = 1

export interface ExportFile {
  app: typeof EXPORT_APP
  version: typeof EXPORT_VERSION
  exportedAt: string
  attempts: Omit<Attempt, 'id'>[]
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

// 錯題本：最近一次答錯的題目，最新的排前面
export function wrongQuestionIds(attempts: Attempt[]) {
  return [...latestByQuestion(attempts).values()]
    .filter((attempt) => !attempt.correct)
    .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))
    .map((attempt) => attempt.questionId)
}

export function summary(attempts: Attempt[]) {
  const correct = attempts.filter((a) => a.correct).length
  return {
    total: attempts.length,
    correct,
    rate: attempts.length ? correct / attempts.length : 0,
  }
}

export function toExport(attempts: Attempt[], now = new Date()): ExportFile {
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
  }
}

function isAttempt(value: unknown): value is Omit<Attempt, 'id'> {
  if (typeof value !== 'object' || value === null) return false
  const a = value as Record<string, unknown>
  return (
    typeof a.questionId === 'string' &&
    typeof a.conceptId === 'string' &&
    typeof a.choice === 'string' &&
    typeof a.correct === 'boolean' &&
    typeof a.answeredAt === 'string' &&
    !Number.isNaN(Date.parse(a.answeredAt))
  )
}

// 讀取匯出檔；格式不符時丟出可直接顯示給使用者的錯誤訊息
export function parseExport(text: string): Omit<Attempt, 'id'>[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('檔案不是有效的 JSON。')
  }
  const file = data as Partial<ExportFile> | null
  if (!file || file.app !== EXPORT_APP) throw new Error('這不是本網站匯出的學習紀錄檔。')
  if (file.version !== EXPORT_VERSION) throw new Error(`不支援的紀錄檔版本：${String(file.version)}。`)
  if (!Array.isArray(file.attempts) || !file.attempts.every(isAttempt)) {
    throw new Error('紀錄檔內容格式不正確。')
  }
  return file.attempts.map(({ questionId, conceptId, choice, correct, answeredAt }) => ({
    questionId,
    conceptId,
    choice,
    correct,
    answeredAt,
  }))
}

// 匯入時只留下還沒有的紀錄（同一題、同一個作答時間視為同一筆）
export function newAttempts(existing: Attempt[], incoming: Omit<Attempt, 'id'>[]) {
  const seen = new Set(existing.map((a) => `${a.questionId}@${a.answeredAt}`))
  const fresh: Omit<Attempt, 'id'>[] = []
  for (const attempt of incoming) {
    const key = `${attempt.questionId}@${attempt.answeredAt}`
    if (seen.has(key)) continue
    seen.add(key)
    fresh.push(attempt)
  }
  return fresh
}
