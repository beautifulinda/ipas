import type { Concept, Question, TopicMap } from '~/types/map'
import type { Attempt } from '~/utils/progress'

export function question(id: string, reviewed = true): Question {
  return {
    id,
    type: 'single',
    stem: `題目 ${id}`,
    options: [
      { id: 'A', text: '甲' },
      { id: 'B', text: '乙' },
    ],
    answer: 'A',
    explanation: '',
    difficulty: 1,
    source: { type: 'original' },
    reviewed,
  }
}

export function concept(id: string, questions: Question[] = []): Concept {
  return { id, title: `概念 ${id}`, summary: '', keyPoints: [], questions }
}

// 一座島（S1）兩個地區：C1 有兩個概念、C2 有一個概念
export function sampleMap(): TopicMap {
  return {
    version: '1',
    updatedAt: '2026-10-21',
    disclaimer: '',
    subjects: [
      {
        id: 'S1',
        title: '科目一',
        categories: [
          {
            id: 'C1',
            title: '地區一',
            concepts: [concept('K1', [question('q1'), question('q2')]), concept('K2', [question('q3')])],
          },
          { id: 'C2', title: '地區二', concepts: [concept('K3', [question('q4')])] },
        ],
      },
    ],
  }
}

let clock = 0
export function attempt(questionId: string, correct: boolean, answeredAt?: string): Attempt {
  clock += 1
  return {
    questionId,
    conceptId: '',
    choice: correct ? 'A' : 'B',
    correct,
    answeredAt: answeredAt ?? new Date(Date.UTC(2026, 9, 21, 0, 0, clock)).toISOString(),
  }
}
