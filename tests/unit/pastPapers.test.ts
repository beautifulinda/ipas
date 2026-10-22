import { describe, expect, it } from 'vitest'
import type { PastExam, Question } from '~/types/map'
import { examLabel, mergePastPapers, sessionLabel, sortForPractice, sourceLabel } from '~/utils/pastPapers'
import { question } from './fixtures'

// 題目內容一律是假的，不可複製真的考古題
function past(id: string, ...exams: PastExam[]): Question {
  return { ...question(id), stem: `假題目 ${id}`, source: { type: 'official-past', exams } }
}

describe('出處文字', () => {
  it('梯次寫成國字', () => {
    expect(sessionLabel('114-S4')).toBe('114 年第四次')
    expect(sessionLabel('115-S10')).toBe('115 年第十次')
    expect(sessionLabel('115-S12')).toBe('115 年第十二次')
    expect(examLabel({ session: '115-S1', paper: 2, number: 50 })).toBe('115 年第一次 第二科 第 50 題')
  })

  it('考過多次時出處由舊到新排列', () => {
    const q = past('p', { session: '115-S2', paper: 1, number: 7 }, { session: '114-S4', paper: 1, number: 1 })
    expect(sourceLabel(q)).toBe('出處：114 年第四次 第一科 第 1 題、115 年第二次 第一科 第 7 題（考過 2 次）')
  })

  it('自編題沒有出處文字', () => {
    expect(sourceLabel(question('own'))).toBeUndefined()
  })
})

describe('練習題順序', () => {
  it('考古題依梯次由新到舊，自編題排最後並維持原順序', () => {
    const questions = [
      question('own-1'),
      past('a', { session: '114-S4', paper: 1, number: 1 }),
      question('own-2'),
      past('c', { session: '115-S3', paper: 1, number: 1 }),
      past('b', { session: '115-S1', paper: 1, number: 1 }),
    ]
    expect(sortForPractice(questions).map((q) => q.id)).toEqual(['c', 'b', 'a', 'own-1', 'own-2'])
  })

  it('同一年的第十次排在第二次之後（不是照字串排序）', () => {
    const questions = [past('s2', { session: '115-S2', paper: 1, number: 1 }), past('s10', { session: '115-S10', paper: 1, number: 1 })]
    expect(sortForPractice(questions).map((q) => q.id)).toEqual(['s10', 's2'])
  })
})

describe('合併同一題', () => {
  it('沿用最早那次的 ID，即使較新的那筆排在前面', () => {
    const newer = past('past-115-S2-1-07', { session: '115-S2', paper: 1, number: 7 })
    const older = { ...past('past-114-S4-1-01', { session: '114-S4', paper: 1, number: 1 }), stem: newer.stem }
    const { items, errors } = mergePastPapers([
      { conceptId: 'K', question: newer },
      { conceptId: 'K', question: older },
    ])
    expect(errors).toEqual([])
    expect(items).toHaveLength(1)
    expect(items[0].question.id).toBe('past-114-S4-1-01')
    expect(items[0].question.source.exams).toHaveLength(2)
  })

  it('標點、空白、全形半形不同仍算同一題', () => {
    const a = { ...past('a', { session: '114-S4', paper: 1, number: 1 }), stem: '下列何者正確？（單選）' }
    const b = { ...past('b', { session: '115-S1', paper: 1, number: 2 }), stem: '下列何者正確?(單選)' }
    expect(mergePastPapers([{ conceptId: 'K', question: a }, { conceptId: 'K', question: b }]).items).toHaveLength(1)
  })

  it('選項文字不同就是不同的題目', () => {
    const a = past('a', { session: '114-S4', paper: 1, number: 1 })
    const b = { ...a, id: 'b', options: [{ id: 'A', text: '甲' }, { id: 'B', text: '丙' }], source: { type: 'official-past' as const, exams: [{ session: '115-S1', paper: 1 as const, number: 2 }] } }
    expect(mergePastPapers([{ conceptId: 'K', question: a }, { conceptId: 'K', question: b }]).items).toHaveLength(2)
  })
})
