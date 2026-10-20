export type Difficulty = 1 | 2 | 3

export interface QuestionOption {
  id: string // 例如 "A"
  text: string
}

export interface QuestionSource {
  type: 'original' | 'official-link'
  url?: string // type 為 official-link 時必填
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
