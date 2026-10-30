import type { TopicMap } from '~/types/map'
import { practiceQuestions } from '~/utils/concepts'
import { latestByQuestion, type Attempt } from '~/utils/progress'

// 城鎮等級：0 工地（還沒答對任何一題，全部答錯也算）、1 帳篷（至少答對 1 題但不到一半）、
// 2 房子（半數以上最近一次答對）、3 城堡（全部最近一次答對）。作者 2026-10-22 決定全錯維持工地
export type TownLevel = 0 | 1 | 2 | 3

export const TOWN_LEVEL_NAMES: Record<TownLevel, string> = {
  0: '工地',
  1: '帳篷',
  2: '房子',
  3: '城堡',
}

export interface TownProgress {
  // 最近一次答對、答錯的題數；其餘是還沒作答
  correct: number
  wrong: number
  total: number
}

// 目前選到的城鎮旁顯示的數字（需求在 tests/features/練習回饋.feature）；
// 不能只靠紅綠區分，所以加 ✓／✗ 符號，沒有的項目不顯示
export function progressText(progress: TownProgress) {
  const unanswered = progress.total - progress.correct - progress.wrong
  return [
    progress.correct && `✓ ${progress.correct}`,
    progress.wrong && `✗ ${progress.wrong}`,
    unanswered && `未答 ${unanswered}`,
  ]
    .filter(Boolean)
    .join('・')
}

export interface Progression {
  townLevels: Map<string, TownLevel>
  // 只有已有題目的概念才有進度
  townProgress: Map<string, TownProgress>
  // 作答過（不論對錯）的城鎮；「從這裡開始」跳過這些城鎮
  practicedTowns: Set<string>
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
    practicedTowns: new Set(),
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
        else if (correct.length) level = 1
        result.townLevels.set(concept.id, level)
        if (questions.length) result.townProgress.set(concept.id, {
            correct: correct.length,
            wrong: answered.length - correct.length,
            total: questions.length,
          })

        if (answered.length) {
          result.practicedTowns.add(concept.id)
          result.exploredRegions.add(category.id)
        }
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
        if (progression.townProgress.has(concept.id) && !progression.practicedTowns.has(concept.id)) return concept.id
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

// 下一站（需求在 tests/features/下一站.feature）：目前的主題全部作答過（答錯也算）時，
// 依官方順序往後找第一個還有題目沒作答的主題，到最後再從頭找；目前的主題還沒做完或全部都做完時不建議
export function nextStop(map: TopicMap, progression: Progression, currentId: string) {
  const unfinished = (id: string) => {
    const progress = progression.townProgress.get(id)
    return Boolean(progress && progress.correct + progress.wrong < progress.total)
  }
  if (!progression.townProgress.has(currentId) || unfinished(currentId)) return undefined
  const ids = map.subjects.flatMap((s) => s.categories.flatMap((c) => c.concepts.map((concept) => concept.id)))
  const at = ids.indexOf(currentId)
  return [...ids.slice(at + 1), ...ids.slice(0, at)].find(unfinished)
}

export function nextStopText(title: string) {
  return `🎉 全部作答完了！\n下一站：${title} →`
}

export function milestoneText(milestone: Milestone) {
  return MILESTONE_TEXT[milestone.kind](milestone.title)
}

export function isMajorMilestone(milestone: Milestone) {
  return milestone.kind === 'castle' || milestone.kind === 'flag' || milestone.kind === 'lighthouse'
}

const UPGRADE_KIND: Record<TownLevel, Milestone['kind'] | undefined> = { 0: undefined, 1: 'tent', 2: 'house', 3: 'castle' }

// 升級演出（需求在 tests/features/升級演出.feature）：同時達成好幾個里程碑時只演最大的那一個，
// 演出依等級加碼——帳篷、房子跳升級卡；城堡、插旗、燈塔是完整的里程碑演出。
// 系統開啟減少動態效果時，會動的部分（星星、煙火、彩帶、光柱、鏡頭）都關掉，升級卡與音效照常
const MILESTONE_RANK: Record<Milestone['kind'], number> = { tent: 1, house: 2, castle: 3, flag: 4, lighthouse: 5 }

export function featuredMilestone(milestones: readonly Milestone[]): Milestone | undefined {
  return milestones.reduce<Milestone | undefined>((best, m) => (!best || MILESTONE_RANK[m.kind] > MILESTONE_RANK[best.kind] ? m : best), undefined)
}

export type CelebrationSound = 'chime2' | 'chime3' | 'fanfare'

export interface CelebrationPlan {
  milestone: Milestone
  // 建築上方冒出的金色星星顆數
  stars: number
  // 煙火發數
  fireworks: number
  confetti: 'none' | 'few' | 'many'
  // 往上射出的金色光柱
  pillar: boolean
  // 鏡頭靠近繞半圈再回到原位
  camera: boolean
  sound: CelebrationSound | undefined
  // card：畫面上方的升級卡；plaque：畫面中央有皇冠的里程碑匾額
  banner: 'card' | 'plaque'
}

export function celebrationFor(
  milestones: readonly Milestone[],
  options: { reducedMotion: boolean; soundOn: boolean },
): CelebrationPlan | undefined {
  const milestone = featuredMilestone(milestones)
  if (!milestone) return undefined
  const grand = isMajorMilestone(milestone)
  const motion = !options.reducedMotion
  const sound: CelebrationSound = milestone.kind === 'tent' ? 'chime2' : milestone.kind === 'house' ? 'chime3' : 'fanfare'
  return {
    milestone,
    stars: motion ? (grand ? 120 : milestone.kind === 'house' ? 100 : 60) : 0,
    fireworks: motion ? (grand ? 3 : milestone.kind === 'house' ? 1 : 0) : 0,
    confetti: motion ? (grand ? 'many' : milestone.kind === 'house' ? 'few' : 'none') : 'none',
    pillar: motion && grand,
    camera: motion && grand,
    sound: options.soundOn ? sound : undefined,
    banner: grand ? 'plaque' : 'card',
  }
}

// 升級卡的標題，例如「升級為帳篷！」；匾額下方緞帶的文字
export function upgradeCardTitle(kind: 'tent' | 'house') {
  return `升級為${TOWN_LEVEL_NAMES[kind === 'tent' ? 1 : 2]}！`
}
export const PLAQUE_RIBBON: Record<'castle' | 'flag' | 'lighthouse', string> = {
  castle: '城堡完成',
  flag: '地區全部掌握',
  lighthouse: '全島點亮',
}

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

// 題庫擴充造成的降級：記下每個城鎮上次看到的考古題數與等級，下次打開時比較
export type TownSnapshot = Record<string, { past: number; level: TownLevel }>

export interface ExpansionNotice {
  conceptId: string
  title: string
  added: number
}

export function townSnapshot(map: TopicMap, progression: Progression): TownSnapshot {
  const snapshot: TownSnapshot = {}
  for (const subject of map.subjects) {
    for (const category of subject.categories) {
      for (const concept of category.concepts) {
        const past = practiceQuestions(concept).filter((q) => q.source.type === 'official-past').length
        snapshot[concept.id] = { past, level: progression.townLevels.get(concept.id) ?? 0 }
      }
    }
  }
  return snapshot
}

// 考古題變多、等級因此降低的城鎮；第一次打開（沒有上次紀錄）不提示
export function expansionNotices(map: TopicMap, before: TownSnapshot | undefined, after: TownSnapshot): ExpansionNotice[] {
  if (!before) return []
  const notices: ExpansionNotice[] = []
  for (const subject of map.subjects) {
    for (const category of subject.categories) {
      for (const concept of category.concepts) {
        const was = before[concept.id]
        const now = after[concept.id]
        if (was && now && now.past > was.past && now.level < was.level) {
          notices.push({ conceptId: concept.id, title: concept.title, added: now.past - was.past })
        }
      }
    }
  }
  return notices
}

export function expansionText(notice: ExpansionNotice) {
  return `「${notice.title}」新增了 ${notice.added} 題考古題`
}
