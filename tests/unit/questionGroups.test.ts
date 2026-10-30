import { describe, expect, it } from 'vitest'
import { groupOf, questionGroups } from '~/utils/questionGroups'

describe('題號分組', () => {
  it('10 題以下不分組', () => {
    expect(questionGroups(0)).toEqual([])
    expect(questionGroups(10)).toEqual([])
  })

  it('超過 10 題時每 10 題一組，最後一組可以不滿 10 題', () => {
    expect(questionGroups(34).map((g) => g.label)).toEqual(['1–10', '11–20', '21–30', '31–34'])
    expect(questionGroups(34)[3]).toEqual({ start: 30, end: 34, label: '31–34' })
  })

  it('最後一組只有 1 題時組名只寫題號', () => {
    expect(questionGroups(11).map((g) => g.label)).toEqual(['1–10', '11'])
  })

  it('依題目位置找出所在的組', () => {
    expect(groupOf(0)).toBe(0)
    expect(groupOf(9)).toBe(0)
    expect(groupOf(10)).toBe(1)
    expect(groupOf(33)).toBe(3)
  })
})
