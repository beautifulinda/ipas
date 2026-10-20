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

export interface Progression {
  townLevels: Map<string, TownLevel>
  // 地區有任何一題作答過，雲霧就散開
  exploredRegions: Set<string>
  // 地區裡有題目的概念全部升到城堡，插上旗子
  flaggedRegions: Set<string>
  // 島上有題目的地區全部插旗，燈塔亮起
  litIslands: Set<string>
}

export interface Milestone {
  kind: 'castle' | 'flag' | 'lighthouse'
  id: string
  title: string
}

export function computeProgression(map: TopicMap, attempts: readonly Attempt[]): Progression {
  const latest = latestByQuestion([...attempts])
  const result: Progression = {
    townLevels: new Map(),
    exploredRegions: new Set(),
    flaggedRegions: new Set(),
    litIslands: new Set(),
  }

  for (const subject of map.subjects) {
    let islandHasGoal = false
    let islandComplete = true
    for (const category of subject.categories) {
      let regionHasGoal = false
      let regionComplete = true
      for (const concept of category.concepts) {
        const questions = practiceQuestions(concept)
        const answered = questions.filter((q) => latest.has(q.id))
        const correct = questions.filter((q) => latest.get(q.id)?.correct)
        let level: TownLevel = 0
        if (questions.length && correct.length === questions.length) level = 3
        else if (questions.length && correct.length * 2 >= questions.length) level = 2
        else if (answered.length) level = 1
        result.townLevels.set(concept.id, level)

        if (answered.length) result.exploredRegions.add(category.id)
        // 沒有題目的概念不算進里程碑，免得永遠無法完成
        if (questions.length) {
          regionHasGoal = true
          if (level < 3) regionComplete = false
        }
      }
      if (regionHasGoal) {
        islandHasGoal = true
        if (regionComplete) result.flaggedRegions.add(category.id)
        else islandComplete = false
      }
    }
    if (islandHasGoal && islandComplete) result.litIslands.add(subject.id)
  }
  return result
}

// 比較作答前後，找出這次新達成的里程碑
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
    if (level === 3 && before.townLevels.get(id) !== 3) milestones.push({ kind: 'castle', id, title: titles.get(id)! })
  }
  for (const id of after.flaggedRegions) {
    if (!before.flaggedRegions.has(id)) milestones.push({ kind: 'flag', id, title: titles.get(id)! })
  }
  for (const id of after.litIslands) {
    if (!before.litIslands.has(id)) milestones.push({ kind: 'lighthouse', id, title: titles.get(id)! })
  }
  return milestones
}
