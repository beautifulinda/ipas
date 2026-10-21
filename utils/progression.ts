import type { TopicMap } from '~/types/map'
import { practiceQuestions } from '~/utils/concepts'
import { latestByQuestion, type Attempt } from '~/utils/progress'

// 城鎮等級：0 工地（還沒練習）、1 帳篷（作答過）、2 房子（半數以上最近一次答對）、3 城堡（全部最近一次答對）
export type TownLevel = 0 | 1 | 2 | 3

export const TOWN_LEVEL_NAMES: Record<TownLevel, string> = {
  0: '工地',
  1: '帳篷',
  2: '房子',
  3: '城堡',
}

export interface TownProgress {
  // 最近一次答對的題數
  correct: number
  total: number
}

export interface Progression {
  townLevels: Map<string, TownLevel>
  // 只有已有題目的概念才有進度
  townProgress: Map<string, TownProgress>
  // 地區有任何一題作答過，雲霧就散開
  exploredRegions: Set<string>
  // 地區裡的概念全部升到城堡，插上旗子
  flaggedRegions: Set<string>
  // 島上的地區全部插旗，燈塔亮起
  litIslands: Set<string>
}

// tent、house 是一般升級（放煙火、跳出恭喜訊息）；castle、flag、lighthouse 是大事件（放煙火、出現里程碑匾額）
export interface Milestone {
  kind: 'tent' | 'house' | 'castle' | 'flag' | 'lighthouse'
  id: string
  title: string
}

export function computeProgression(map: TopicMap, attempts: readonly Attempt[]): Progression {
  const latest = latestByQuestion([...attempts])
  const result: Progression = {
    townLevels: new Map(),
    townProgress: new Map(),
    exploredRegions: new Set(),
    flaggedRegions: new Set(),
    litIslands: new Set(),
  }

  for (const subject of map.subjects) {
    // 沒有題目的概念無法升級，視為尚未完成：題庫還沒補齊的地區不會插旗，島也不會亮燈
    let islandComplete = subject.categories.length > 0
    for (const category of subject.categories) {
      let regionComplete = category.concepts.length > 0
      for (const concept of category.concepts) {
        const questions = practiceQuestions(concept)
        const answered = questions.filter((q) => latest.has(q.id))
        const correct = questions.filter((q) => latest.get(q.id)?.correct)
        let level: TownLevel = 0
        if (questions.length && correct.length === questions.length) level = 3
        else if (questions.length && correct.length * 2 >= questions.length) level = 2
        else if (answered.length) level = 1
        result.townLevels.set(concept.id, level)
        if (questions.length) result.townProgress.set(concept.id, { correct: correct.length, total: questions.length })

        if (answered.length) result.exploredRegions.add(category.id)
        if (level < 3) regionComplete = false
      }
      if (regionComplete) result.flaggedRegions.add(category.id)
      else islandComplete = false
    }
    if (islandComplete) result.litIslands.add(subject.id)
  }
  return result
}

// 建議從哪裡開始：依官方順序，第一個有題目、還沒練習過的概念；都練習過或沒有題目時不建議
export function recommendedStart(map: TopicMap, progression: Progression) {
  for (const subject of map.subjects) {
    for (const category of subject.categories) {
      for (const concept of category.concepts) {
        if (progression.townProgress.has(concept.id) && progression.townLevels.get(concept.id) === 0) return concept.id
      }
    }
  }
}

// 達成里程碑時的訊息；一般升級只說恭喜，大事件寫在匾額上
const UPGRADE_TEXT = '🎉 恭喜升級了，你超棒！'
const MILESTONE_TEXT: Record<Milestone['kind'], (title: string) => string> = {
  tent: () => UPGRADE_TEXT,
  house: () => UPGRADE_TEXT,
  castle: (title) => `🏰 ${title} 升級為${TOWN_LEVEL_NAMES[3]}！`,
  flag: (title) => `🚩 ${title} 全部掌握，插上旗子！`,
  lighthouse: (title) => `🗼 ${title} 的燈塔亮起來了！`,
}

export function milestoneText(milestone: Milestone) {
  return MILESTONE_TEXT[milestone.kind](milestone.title)
}

export function isMajorMilestone(milestone: Milestone) {
  return milestone.kind === 'castle' || milestone.kind === 'flag' || milestone.kind === 'lighthouse'
}

const UPGRADE_KIND: Record<TownLevel, Milestone['kind'] | undefined> = { 0: undefined, 1: 'tent', 2: 'house', 3: 'castle' }

// 比較作答前後，找出這次新達成的里程碑；城鎮一次升好幾級時只算最高的那一級，降級不算
export function newMilestones(map: TopicMap, before: Progression, after: Progression): Milestone[] {
  const titles = new Map<string, string>()
  for (const subject of map.subjects) {
    titles.set(subject.id, subject.title)
    for (const category of subject.categories) {
      titles.set(category.id, category.title)
      for (const concept of category.concepts) titles.set(concept.id, concept.title)
    }
  }
  const milestones: Milestone[] = []
  for (const [id, level] of after.townLevels) {
    const kind = UPGRADE_KIND[level]
    if (kind && level > (before.townLevels.get(id) ?? 0)) milestones.push({ kind, id, title: titles.get(id)! })
  }
  for (const id of after.flaggedRegions) {
    if (!before.flaggedRegions.has(id)) milestones.push({ kind: 'flag', id, title: titles.get(id)! })
  }
  for (const id of after.litIslands) {
    if (!before.litIslands.has(id)) milestones.push({ kind: 'lighthouse', id, title: titles.get(id)! })
  }
  return milestones
}
