import { describe, expect, it } from 'vitest'
import { celebrationFor, computeProgression, featuredMilestone, newMilestones, type Milestone } from '~/utils/progression'
import { attempt, concept, question, sampleMap } from './fixtures'

describe('computeProgression：城鎮等級', () => {
  it('還沒作答是工地，地區蓋著雲霧', () => {
    const progression = computeProgression(sampleMap(), [])
    expect(progression.townLevels.get('K1')).toBe(0)
    expect(progression.exploredRegions.size).toBe(0)
  })

  it('全部答錯仍是工地，但雲霧散開', () => {
    const progression = computeProgression(sampleMap(), [attempt('q1', false)])
    expect(progression.townLevels.get('K1')).toBe(0)
    expect(progression.practicedTowns.has('K1')).toBe(true)
    expect(progression.exploredRegions.has('C1')).toBe(true)
    expect(progression.exploredRegions.has('C2')).toBe(false)
  })

  it('至少答對 1 題但不到一半是帳篷', () => {
    const map = sampleMap()
    map.subjects[0].categories[0].concepts[0].questions.push(question('q1b'))
    const progression = computeProgression(map, [attempt('q1', true), attempt('q2', false)])
    expect(progression.townLevels.get('K1')).toBe(1)
  })

  it('帳篷的題目後來全部答錯，降回工地', () => {
    const map = sampleMap()
    map.subjects[0].categories[0].concepts[0].questions.push(question('q1b'))
    expect(computeProgression(map, [attempt('q1', true), attempt('q1', false)]).townLevels.get('K1')).toBe(0)
  })

  it('半數以上最近一次答對是房子', () => {
    expect(computeProgression(sampleMap(), [attempt('q1', true)]).townLevels.get('K1')).toBe(2)
  })

  it('全部題目最近一次答對才是城堡；之後答錯會降級', () => {
    const castle = [attempt('q1', true), attempt('q2', true)]
    expect(computeProgression(sampleMap(), castle).townLevels.get('K1')).toBe(3)
    expect(computeProgression(sampleMap(), [...castle, attempt('q2', false)]).townLevels.get('K1')).toBe(2)
  })

  it('未審核的題目不計入', () => {
    const map = sampleMap()
    map.subjects[0].categories[0].concepts[0].questions.push(question('draft', false))
    const progression = computeProgression(map, [attempt('q1', true), attempt('q2', true)])
    expect(progression.townLevels.get('K1')).toBe(3)
  })
})

describe('computeProgression：旗子與燈塔', () => {
  const allCorrect = ['q1', 'q2', 'q3', 'q4'].map((id) => attempt(id, true))

  it('地區的概念全是城堡就插旗，全島插旗則燈塔亮起', () => {
    const progression = computeProgression(sampleMap(), allCorrect)
    expect([...progression.flaggedRegions].sort()).toEqual(['C1', 'C2'])
    expect(progression.litIslands.has('S1')).toBe(true)
  })

  it('只完成一個地區時，那個地區插旗但燈塔不亮', () => {
    const progression = computeProgression(sampleMap(), allCorrect.slice(0, 3))
    expect([...progression.flaggedRegions]).toEqual(['C1'])
    expect(progression.litIslands.size).toBe(0)
  })

  it('有概念還沒有題目時，地區不插旗、島不亮燈', () => {
    const map = sampleMap()
    map.subjects[0].categories[1].concepts.push(concept('K4'))
    const progression = computeProgression(map, allCorrect)
    expect(progression.townLevels.get('K4')).toBe(0)
    expect(progression.flaggedRegions.has('C2')).toBe(false)
    expect(progression.litIslands.size).toBe(0)
  })
})

describe('newMilestones', () => {
  it('只回報這次新達成的城堡、旗子與燈塔', () => {
    const map = sampleMap()
    const earlier = ['q1', 'q2', 'q3'].map((id) => attempt(id, true))
    const before = computeProgression(map, earlier)
    const after = computeProgression(map, [...earlier, attempt('q4', true)])
    expect(newMilestones(map, before, after)).toEqual([
      { kind: 'castle', id: 'K3', title: '概念 K3' },
      { kind: 'flag', id: 'C2', title: '地區二' },
      { kind: 'lighthouse', id: 'S1', title: '科目一' },
    ])
  })

  it('沒有變化時不回報', () => {
    const map = sampleMap()
    const progression = computeProgression(map, [attempt('q1', true)])
    expect(newMilestones(map, progression, progression)).toEqual([])
  })
})

describe('celebrationFor：升級演出依等級加碼', () => {
  const m = (kind: Milestone['kind']): Milestone => ({ kind, id: kind, title: kind })
  const normal = { reducedMotion: false, soundOn: true }

  it('同時達成好幾個里程碑時只演最大的那一個', () => {
    expect(featuredMilestone([m('castle'), m('flag'), m('house')])?.kind).toBe('flag')
    expect(featuredMilestone([m('flag'), m('lighthouse')])?.kind).toBe('lighthouse')
    expect(featuredMilestone([])).toBeUndefined()
  })

  it('帳篷：星星、兩音鈴聲、升級卡，沒有煙火與彩帶', () => {
    expect(celebrationFor([m('tent')], normal)).toMatchObject({ stars: 60, fireworks: 0, confetti: 'none', pillar: false, camera: false, sound: 'chime2', banner: 'card' })
  })

  it('房子：比帳篷多一發煙火與少量彩帶', () => {
    expect(celebrationFor([m('house')], normal)).toMatchObject({ fireworks: 1, confetti: 'few', sound: 'chime3', banner: 'card' })
  })

  it('城堡、插旗、燈塔：光柱、三發煙火、大量彩帶、號角聲、鏡頭靠近、匾額', () => {
    for (const kind of ['castle', 'flag', 'lighthouse'] as const) {
      expect(celebrationFor([m(kind)], normal)).toMatchObject({ fireworks: 3, confetti: 'many', pillar: true, camera: true, sound: 'fanfare', banner: 'plaque' })
    }
  })

  it('減少動態效果時只保留升級卡與音效', () => {
    expect(celebrationFor([m('castle')], { reducedMotion: true, soundOn: true })).toMatchObject({
      stars: 0, fireworks: 0, confetti: 'none', pillar: false, camera: false, sound: 'fanfare', banner: 'plaque',
    })
  })

  it('關掉音效時不出聲，畫面照常', () => {
    expect(celebrationFor([m('tent')], { reducedMotion: false, soundOn: false })).toMatchObject({ sound: undefined, stars: 60 })
  })

  it('沒有新的里程碑就沒有演出', () => {
    expect(celebrationFor([], normal)).toBeUndefined()
  })
})
