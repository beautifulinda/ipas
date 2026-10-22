// 〈升級時的演出依等級越來越盛大〉的步驟定義：檢查 celebrationFor 決定的演出內容，
// 畫面上實際的動畫由 IslandMap3D、UpgradeCard、MilestonePlaque、ConfettiBurst 依這份計畫播放
import { Given, Then, When } from 'quickpickle'
import { expect } from 'vitest'
import { TOWN_LEVEL_NAMES, milestoneText, upgradeCardTitle, type CelebrationSound } from '~/utils/progression'
import { createSoundPlayer, loadSoundOn, saveSoundOn, type AudioContextLike } from '~/utils/sound'
import { concept, question } from '../unit/fixtures'
import { answer, findConcept, findRegion, mainConcept, progression, type World } from './world'

// 以 localStorage 介面包裝測試用的 Map
const storageOf = (world: World) => ({
  getItem: (key: string) => world.storage.get(key) ?? null,
  setItem: (key: string, value: string) => void world.storage.set(key, value),
})

const LEVEL_OF: Record<string, number> = Object.fromEntries(Object.entries(TOWN_LEVEL_NAMES).map(([level, name]) => [name, Number(level)]))
const KIND_OF_LEVEL = ['', 'tent', 'house', 'castle']

function plan(world: World) {
  expect(world.plan, '這次作答應該有升級演出').toBeDefined()
  return world.plan!
}

// 前提與操作

Given(/^我已經答對第 (\d+(?:、\d+)+) 題$/, (world: World, list: string) => {
  answer(world, mainConcept(world), list.split('、').map(Number), true)
})

// 同一句在城堡場景是結果、在插旗場景是操作：還不是城堡就把題目全部答對
Given(/^「(.+)」升級為城堡$/, (world: World, title: string) => {
  const target = findConcept(world, title)
  if (progression(world).townLevels.get(target.id) !== 3) {
    answer(world, target, target.questions.filter((q) => q.reviewed).map((_, i) => i + 1), true)
  }
  expect(progression(world).townLevels.get(target.id)).toBe(3)
  expect(world.milestones.some((m) => m.kind === 'castle' && m.id === target.id)).toBe(true)
})

// 地區裡另外有一個已經是城堡的主題；島上再放一個還沒完成的地區，燈塔才不會跟著亮
Given(/^「(.+)」除了「(.+)」以外的主題都已經是城堡$/, (world: World, region: string) => {
  const done = { ...concept('K-資料清理', [question('K-資料清理-1')]), title: '資料清理' }
  findRegion(world, region).concepts.push(done)
  world.map.subjects[0].categories.push({
    id: 'C-其他地區',
    title: '其他地區',
    concepts: [{ ...concept('K-其他主題', [question('K-其他主題-1')]), title: '其他主題' }],
  })
  answer(world, done, [1], true)
  expect(progression(world).townLevels.get(done.id)).toBe(3)
})

Given(/^我在「學習紀錄」選單裡關掉音效$/, (world: World) => {
  saveSoundOn(storageOf(world), false)
  world.soundOn = loadSoundOn(storageOf(world))
})

Given(/^我的系統開啟了「減少動態效果」$/, (world: World) => {
  world.reducedMotion = true
})

// 使用者還沒點過頁面：瀏覽器不允許出聲，恢復播放也會被拒絕
Given('我打開網站後還沒有點過任何地方', (world: World) => {
  world.audio = {
    state: 'suspended',
    resume: () => Promise.reject(new Error('NotAllowedError')),
  } as unknown as AudioContextLike
})

When('升級的演出開始', async (world: World) => {
  answer(world, mainConcept(world), [1], true)
  try {
    world.played = await createSoundPlayer(() => world.audio)(plan(world).sound as CelebrationSound)
  } catch (error) {
    world.soundError = error
  }
})

// 建造動畫與等級

Then(/^「(.+)」從(工地|帳篷|房子)縮進塵土，(帳篷|房子|城堡)彈出來$/, (world: World, title: string, from: string, to: string) => {
  const target = findConcept(world, title)
  expect(progression(world).townLevels.get(target.id)).toBe(LEVEL_OF[to])
  expect(LEVEL_OF[from]).toBeLessThan(LEVEL_OF[to])
  // 只有升級才播建造動畫；減少動態效果時直接換
  expect(plan(world).milestone).toMatchObject({ kind: KIND_OF_LEVEL[LEVEL_OF[to]], id: target.id })
  expect(world.reducedMotion).toBe(false)
})

Then(/^「(.+)」直接換成帳篷，沒有建造動畫$/, (world: World, title: string) => {
  expect(progression(world).townLevels.get(findConcept(world, title).id)).toBe(1)
  expect(world.reducedMotion).toBe(true)
})

Then(/^「(.+)」顯示為帳篷，畫面照常演出$/, (world: World, title: string) => {
  expect(progression(world).townLevels.get(findConcept(world, title).id)).toBe(1)
  expect(plan(world)).toMatchObject({ stars: 60, banner: 'card' })
})

Then('沒有建造動畫、星星、煙火、彩帶、聲音或升級卡', (world: World) => {
  expect(world.milestones).toEqual([])
  expect(world.plan).toBeUndefined()
})

// 特效

Then(/^(帳篷|房子)上方冒出金色星星$/, (world: World) => {
  expect(plan(world).stars).toBeGreaterThan(0)
  expect(plan(world).fireworks).toBe(0)
})

Then('房子上方冒出金色星星，再放一發煙火', (world: World) => {
  expect(plan(world).stars).toBeGreaterThan(0)
  expect(plan(world).fireworks).toBe(1)
})

Then('城堡往上射出一道金色光柱，接著連放三發煙火', (world: World) => {
  expect(plan(world)).toMatchObject({ pillar: true, fireworks: 3 })
})

Then(/^畫面兩側噴出(少量|大量)彩帶$/, (world: World, amount: string) => {
  expect(plan(world).confetti).toBe(amount === '少量' ? 'few' : 'many')
})

Then('鏡頭靠近城堡繞半圈，再回到原來的位置', (world: World) => {
  expect(plan(world)).toMatchObject({ camera: true, milestone: { kind: 'castle' } })
})

Then('不會放星星、煙火、彩帶，鏡頭也不會移動', (world: World) => {
  expect(plan(world)).toMatchObject({ stars: 0, fireworks: 0, confetti: 'none', pillar: false, camera: false })
})

Then('畫面照常演出', (world: World) => {
  expect(plan(world).stars).toBeGreaterThan(0)
})

// 插旗

Then(/^只演出「(.+)」插旗的里程碑，不另外演出城堡$/, (world: World, region: string) => {
  expect(world.milestones.map((m) => m.kind)).toContain('castle')
  expect(plan(world).milestone).toEqual({ kind: 'flag', id: findRegion(world, region).id, title: region })
})

Then('鏡頭靠近的是旗子', (world: World) => {
  expect(plan(world)).toMatchObject({ camera: true, milestone: { kind: 'flag' } })
})

// 音效

const SOUNDS: Record<string, CelebrationSound> = { 兩個音的鈴聲: 'chime2', 三個音的鈴聲: 'chime3', 號角聲: 'fanfare' }

Then(/^播放(兩個音的鈴聲|三個音的鈴聲|號角聲)$/, (world: World, name: string) => {
  expect(plan(world).sound).toBe(SOUNDS[name])
})

Then('沒有播放任何聲音', (world: World) => {
  expect(plan(world).sound).toBeUndefined()
})

Then('下次打開網站時，音效仍然是關閉的', (world: World) => {
  expect(loadSoundOn(storageOf(world))).toBe(false)
})

Then('升級卡仍然會出現，音效照常播放', (world: World) => {
  expect(plan(world)).toMatchObject({ banner: 'card', sound: 'chime2' })
})

Then('不會出現錯誤訊息', (world: World) => {
  expect(world.soundError).toBeUndefined()
  expect(world.played).toBe(false)
})

// 升級卡與匾額

Then(/^畫面上方出現升級卡「(.+?)」(?:，下面寫「(.+)」)?$/, (world: World, title: string, text?: string) => {
  const { milestone, banner } = plan(world)
  expect(banner).toBe('card')
  expect(upgradeCardTitle(milestone.kind as 'tent' | 'house')).toBe(title)
  if (text) expect(milestoneText(milestone)).toContain(text)
})

Then(/^升級卡的升級路線標出目前在「(.+)」$/, (world: World, name: string) => {
  expect(plan(world).milestone.kind).toBe(KIND_OF_LEVEL[LEVEL_OF[name]])
})

Then(/^畫面中央出現有皇冠的里程碑匾額「(.+)」$/, (world: World, text: string) => {
  expect(plan(world).banner).toBe('plaque')
  // 畫面上的訊息前面有圖示（例如 🏰），比對時略過
  expect(milestoneText(plan(world).milestone).replace(/^\S+ /, '')).toBe(text)
})
