import { polygonContains } from 'd3-polygon'
import { describe, expect, it } from 'vitest'
import mapData from '~/data/map.json'
import type { TopicMap } from '~/types/map'
import { buildWorld, seededRandom } from '~/utils/islandLayout'
import { ROOT_ID, findPath, toMapTree } from '~/utils/mapTree'
import { sampleMap } from './fixtures'

describe('mapTree', () => {
  it('依 科目 → 分類 → 概念 建立三層樹', () => {
    const tree = toMapTree(sampleMap())
    expect(tree.id).toBe(ROOT_ID)
    expect(tree.children!.map((n) => n.level)).toEqual(['subject'])
    expect(tree.children![0].children!.map((n) => n.id)).toEqual(['C1', 'C2'])
  })

  it('findPath 回傳從根節點到目標的路徑，找不到時只回根節點', () => {
    const tree = toMapTree(sampleMap())
    expect(findPath(tree, 'K2').map((n) => n.id)).toEqual([ROOT_ID, 'S1', 'C1', 'K2'])
    expect(findPath(tree, 'NOPE').map((n) => n.id)).toEqual([ROOT_ID])
  })
})

describe('seededRandom', () => {
  it('同一個種子產生同樣的數列，數值在 [0, 1) 之間', () => {
    const a = seededRandom('L113')
    const b = seededRandom('L113')
    const values = Array.from({ length: 100 }, () => a())
    expect(values).toEqual(Array.from({ length: 100 }, () => b()))
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true)
  })
})

// 用正式題庫的結構驗證島嶼版面
describe('buildWorld（正式題庫）', () => {
  const map = mapData as TopicMap
  const tree = toMapTree(map)
  const counts = {
    subjects: map.subjects.length,
    categories: map.subjects.flatMap((s) => s.categories).length,
    concepts: map.subjects.flatMap((s) => s.categories.flatMap((c) => c.concepts)).length,
  }

  it.each([false, true])('每個科目、分類、概念都有對應的島、地區、城鎮（直式：%s）', (portrait) => {
    const world = buildWorld(tree, portrait)
    expect(world.islands).toHaveLength(counts.subjects)
    expect(world.regions).toHaveLength(counts.categories)
    expect(world.towns).toHaveLength(counts.concepts)
    // 每個節點都有縮放範圍，點擊時才知道鏡頭要框住哪裡
    expect(world.bounds.size).toBe(1 + counts.subjects + counts.categories + counts.concepts)
  })

  it('每次產生的版面都相同', () => {
    const first = buildWorld(tree)
    const second = buildWorld(tree)
    expect(second.towns.map((t) => t.flat)).toEqual(first.towns.map((t) => t.flat))
    expect(second.islands.map((i) => i.path)).toEqual(first.islands.map((i) => i.path))
  })

  it('城鎮都在自己那座島的海岸線內', () => {
    const world = buildWorld(tree)
    const coasts = new Map(world.islands.map((island) => [island.id, island.coast]))
    for (const town of world.towns) {
      expect(polygonContains(coasts.get(town.islandId)!, town.flat), town.id).toBe(true)
    }
  })
})
