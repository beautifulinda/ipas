import { describe, expect, it } from 'vitest'
import { findConcept, practiceQuestions, questionIndex } from '~/utils/concepts'
import { withExtraQuestions } from '~/utils/questionBank'
import { question, sampleMap } from './fixtures'

describe('withExtraQuestions（本機考古題併入題庫）', () => {
  it('沒有額外題目時回傳原本的題庫', () => {
    const map = sampleMap()
    expect(withExtraQuestions(map, [])).toBe(map)
  })

  it('題目併到對應的概念，不改動原本的題庫', () => {
    const map = sampleMap()
    const merged = withExtraQuestions(map, [{ conceptId: 'K3', question: question('past-1') }])
    expect(findConcept(merged, 'K3')!.questions.map((q) => q.id)).toEqual(['q4', 'past-1'])
    expect(findConcept(map, 'K3')!.questions.map((q) => q.id)).toEqual(['q4'])
  })

  it('找不到概念的題目略過', () => {
    const merged = withExtraQuestions(sampleMap(), [{ conceptId: 'NOPE', question: question('past-2') }])
    expect(questionIndex(merged).has('past-2')).toBe(false)
  })
})

describe('practiceQuestions 與 questionIndex', () => {
  it('只有審核通過的題目會出現在練習與索引中', () => {
    const map = sampleMap()
    findConcept(map, 'K1')!.questions.push(question('draft', false))
    expect(practiceQuestions(findConcept(map, 'K1')!).map((q) => q.id)).toEqual(['q1', 'q2'])
    expect(questionIndex(map).has('draft')).toBe(false)
    expect(questionIndex(map).get('q3')).toMatchObject({ conceptId: 'K2', conceptTitle: '概念 K2' })
  })
})
