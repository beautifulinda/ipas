export type Difficulty = 1 | 2 | 3

export interface QuestionOption {
  id: string // 例如 "A"
  text: string
}

// 考古題的一個出處，例如 114 年第四次 第一科 第 1 題
export interface PastExam {
  session: string // 梯次，例如 "114-S4"（114 年第四次）
  paper: 1 | 2 // 考科：1＝第一科（對應 L11）、2＝第二科（對應 L12）
  number: number // 題號
}

export interface QuestionSource {
  // official-past：官方公告試題，放在私人 repo（本機 data/private/），部署時才讀進來，不進公開 repo
  type: 'original' | 'official-link' | 'official-past'
  url?: string // type 為 official-link 時必填
  exams?: PastExam[] // type 為 official-past 時必填；同一題在不同場次考過時有多個出處
  note?: string
}

export interface Question {
  id: string
  type: 'single' // 之後可擴充 'multiple'
  stem: string
  options: QuestionOption[]
  answer: string // 對應 QuestionOption.id
  explanation: string
  difficulty: Difficulty
  source: QuestionSource
  reviewed: boolean // 人工審核通過才可為 true，CI 會擋下 false 的題目
  tags?: string[]
}

export interface Concept {
  id: string
  title: string
  summary: string
  keyPoints: string[]
  questions: Question[] // 可為空陣列
}

export interface Category {
  id: string
  title: string
  description?: string
  concepts: Concept[]
}

export interface Subject {
  id: string
  title: string
  description?: string
  categories: Category[]
}

export interface ScopeSource {
  title: string
  url: string
}

export interface TopicMap {
  version: string
  updatedAt: string // ISO 8601 日期
  disclaimer: string
  scopeSource?: ScopeSource // 科目與分類依據的官方文件
  subjects: Subject[]
}
