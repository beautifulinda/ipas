import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { makeBuilding } from '~/utils/scene/buildings'
import type { TownLevel } from '~/utils/progression'

// 地圖上可能有幾十個城鎮，每棟建築的繪製次數要壓低，手機才跑得動
function drawCalls(object: THREE.Object3D) {
  let count = 0
  object.traverse((o) => {
    if ((o as THREE.Mesh).isMesh || (o as THREE.Line).isLine || (o as THREE.Points).isPoints) count++
  })
  return count
}

// 所有零件的旋轉與縮放
function pose(object: THREE.Object3D) {
  const parts: number[] = []
  object.traverse((o) => parts.push(...o.rotation.toArray().slice(0, 3).map(Number), ...o.scale.toArray()))
  return parts.map((n) => n.toFixed(4)).join(',')
}

describe('makeBuilding：城鎮建築', () => {
  it.each([0, 1, 2, 3] as TownLevel[])('等級 %i 的建築合併後繪製次數不超過 35', (level) => {
    const building = makeBuilding(level)
    expect(drawCalls(building)).toBeLessThanOrEqual(35)
  })

  it('每種建築都有會動的零件，減少動態效果時停在原位', () => {
    for (const level of [0, 1, 2, 3] as TownLevel[]) {
      const building = makeBuilding(level)
      const tick = building.userData.tick
      expect(tick).toBeTypeOf('function')
      tick(1.2, 0.016, false)
      const still = pose(building)
      tick(3.4, 0.016, false)
      expect(pose(building)).toBe(still)
      tick(5.6, 0.016, true)
      expect(pose(building)).not.toBe(still)
    }
  })
})

describe('makeBuilding：建築高度', () => {
  it('城堡比其他建築高很多，箭頭與煙火要依高度放在上方', () => {
    const heights = ([0, 1, 2, 3] as TownLevel[]).map((level) => new THREE.Box3().setFromObject(makeBuilding(level)).max.y)
    expect(heights[3]).toBeGreaterThan(35)
    for (const h of heights.slice(0, 3)) expect(h).toBeLessThan(25)
  })
})
