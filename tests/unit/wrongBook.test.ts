import { describe, expect, it } from 'vitest'
import type { PastExam, Question, TopicMap } from '~/types/map'
import { wrongBookBySubject } from '~/utils/wrongBook'
import { concept, question } from './fixtures'

// 題目內容一律是假的，不可複製真的考古題
function past(id: string, ...exams: PastExam[]): Question {
  return { ...question(id), stem: `假題目 ${id}`, source: { type: 'official-past', exams } }
}

// L11 有兩個梯次的第一科考古題與一題自編題，L12 有一題第二科考古題
function examMap(): TopicMap {
  return {
    version: '1',
    updatedAt: '2026-10-26',
    disclaimer: '',
    subjects: [
      {
        id: 'L11',
        title: '科目一',
        categories: [
          {
            id: 'L111',
            title: '地區一',
            concepts: [
              concept('K1', [
                past('a', { session: '114-S4', paper: 1, number: 3 }),
                past('b', { session: '114-S4', paper: 1, number: 9 }, { session: '115-S1', paper: 1, number: 2 }),
                question('own'),
              ]),
            ],
          },
        ],
      },
      {
        id: 'L12',
        title: '科目二',
        categories: [{ id: 'L121', title: '地區二', concepts: [concept('K2', [past('c', { session: '115-S1', paper: 2, number: 1 })])] }],
      },
    ],
  }
}

describe('錯題本分組', () => {
  it('L11、L12 分開，各自算錯題數', () => {
    const [l11, l12] = wrongBookBySubject(examMap(), ['a', 'c'], new Set(['a', 'c']))
    expect(l11.wrongCount).toBe(1)
    expect(l12.wrongCount).toBe(1)
    expect(l12.groups.map((g) => g.title)).toEqual(['115 年第一次 第二科'])
  })

  it('考古題依梯次由新到舊分組，每次都以 50 題為分母，並算出作答過幾題', () => {
    const [l11] = wrongBookBySubject(examMap(), ['a'], new Set(['a', 'b']))
    expect(l11.groups.map((g) => [g.title, g.wrong.length, g.answered, g.size])).toEqual([
      ['115 年第一次 第一科', 0, 1, 50],
      ['114 年第四次 第一科', 1, 2, 50],
    ])
    expect(l11.groups[1].wrong[0].number).toBe(3)
  })

  it('同一題考過兩次，兩個梯次都算一題錯，但科目的錯題數只算一題', () => {
    const [l11] = wrongBookBySubject(examMap(), ['b'], new Set(['b']))
    expect(l11.groups.map((g) => g.wrong.length)).toEqual([1, 1])
    expect(l11.wrongCount).toBe(1)
  })

  it('自編題有錯題時另成一組排在最後，沒有分母', () => {
    const [l11] = wrongBookBySubject(examMap(), ['own'], new Set(['own']))
    const last = l11.groups.at(-1)!
    expect(last.title).toBe('自編題')
    expect(last.wrong.map((w) => w.question.id)).toEqual(['own'])
    expect(last.size).toBeUndefined()
  })

  it('沒有自編題錯題時不列自編題', () => {
    const [l11] = wrongBookBySubject(examMap(), [], new Set())
    expect(l11.groups.some((g) => g.key === 'original')).toBe(false)
  })

  it('同一組裡依錯題本的順序（最近答錯的在前）', () => {
    const [l11] = wrongBookBySubject(examMap(), ['b', 'a'], new Set(['a', 'b']))
    expect(l11.groups[1].wrong.map((w) => w.question.id)).toEqual(['b', 'a'])
  })
})
