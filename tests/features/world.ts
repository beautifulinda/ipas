// 需求測試共用的狀態：模擬一份題庫、使用者的作答與錯題本移除紀錄
import type { Concept, TopicMap } from '~/types/map'
import { DISMISS_PROMPT, shouldAskDismiss, wrongBook, type Attempt, type Dismissal } from '~/utils/progress'
import { celebrationFor, computeProgression, newMilestones, type CelebrationPlan, type Milestone } from '~/utils/progression'
import type { AudioContextLike } from '~/utils/sound'
import { concept, question } from '../unit/fixtures'

export interface World {
  map: TopicMap
  attempts: Attempt[]
  dismissals: Dismissal[]
  // 最近一次作答新達成的里程碑（放煙火）
  milestones: Milestone[]
  // 最近一次作答的升級演出；沒有升級時是 undefined
  plan?: CelebrationPlan
  // 使用者設定：音效開關、系統的減少動態效果；storage 模擬瀏覽器的 localStorage
  soundOn: boolean
  reducedMotion: boolean
  storage: Map<string, string>
  // 音效播放：模擬的瀏覽器音訊、這次有沒有出聲、播放時丟出的錯誤
  audio?: AudioContextLike
  played?: boolean
  soundError?: unknown
  // 畫面上正在詢問的訊息與對應題目
  prompt?: { text: string; questionId: string }
  // 打開主題時畫面停在第幾題（從 1 起算）；換題後是目前這題
  resume?: number
  // 打開的主題、題號列正在顯示第幾組（從 0 起算）
  opened?: string
  shownGroup?: number
  // 地圖上選到的主題
  selected?: string
  clock: number
}

// 建立一座島、一個地區、一個主題，主題有指定數量的已審核題目
export function setup(world: World, region: string, title: string, count: number) {
  const id = `K-${title}`
  const questions = Array.from({ length: count }, (_, i) => question(`${id}-${i + 1}`))
  world.map = {
    version: '1',
    updatedAt: '2026-01-01',
    disclaimer: '',
    subjects: [
      {
        id: 'S',
        title: '科目',
        categories: [{ id: `C-${region}`, title: region, concepts: [{ ...concept(id, questions), title }] }],
      },
    ],
  }
  world.attempts = []
  world.dismissals = []
  world.milestones = []
  world.plan = undefined
  world.soundOn = true
  world.reducedMotion = false
  world.storage = new Map()
  world.prompt = undefined
  world.resume = undefined
  world.opened = undefined
  world.shownGroup = undefined
  world.selected = undefined
  world.clock = 0
}

function tick(world: World) {
  world.clock += 1
  return new Date(Date.UTC(2026, 0, 1, 0, 0, world.clock)).toISOString()
}

// 「1～3」「1、2、4」這兩種寫法都轉成題號清單
export function numbers(text: string) {
  const range = text.match(/^(\d+)～(\d+)$/)
  if (range) {
    const [from, to] = [Number(range[1]), Number(range[2])]
    return Array.from({ length: to - from + 1 }, (_, i) => from + i)
  }
  return text.split('、').map(Number)
}

export function findConcept(world: World, title: string) {
  for (const category of world.map.subjects[0].categories) {
    const found = category.concepts.find((c) => c.title === title)
    if (found) return found
  }
  throw new Error(`需求裡沒有主題「${title}」`)
}

export function findRegion(world: World, title: string) {
  const found = world.map.subjects[0].categories.find((c) => c.title === title)
  if (!found) throw new Error(`需求裡沒有地區「${title}」`)
  return found
}

// 需求裡沒有指名主題時，指的是背景建立的第一個主題
export function mainConcept(world: World) {
  return world.map.subjects[0].categories[0].concepts[0]
}

// 第 n 題（只算已審核的題目）
export function questionId(target: Concept, n: number) {
  const q = target.questions.filter((item) => item.reviewed)[n - 1]
  if (!q) throw new Error(`主題「${target.title}」沒有第 ${n} 題`)
  return q.id
}

export function progression(world: World) {
  return computeProgression(world.map, world.attempts)
}

export function book(world: World) {
  return wrongBook(world.attempts, world.dismissals)
}

// 作答：和畫面相同的順序，先判斷要不要詢問移出錯題本，再記下作答，最後比較前後找出新達成的里程碑
export function answer(world: World, target: Concept, numbers: number[], correct: boolean) {
  const before = progression(world)
  world.prompt = undefined
  for (const n of numbers) {
    const id = questionId(target, n)
    if (shouldAskDismiss(id, correct, world.attempts, world.dismissals)) {
      world.prompt = { text: DISMISS_PROMPT, questionId: id }
    }
    world.attempts.push({
      questionId: id,
      conceptId: target.id,
      choice: correct ? 'A' : 'B',
      correct,
      answeredAt: tick(world),
    })
  }
  world.milestones = newMilestones(world.map, before, progression(world))
  world.plan = celebrationFor(world.milestones, { reducedMotion: world.reducedMotion, soundOn: world.soundOn })
}

export function dismiss(world: World, id: string) {
  world.dismissals.push({ questionId: id, dismissedAt: tick(world) })
}
