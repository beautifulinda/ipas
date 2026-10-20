import type { Concept, Question, TopicMap } from '~/types/map'

export function findConcept(map: TopicMap, id: string): Concept | undefined {
  for (const subject of map.subjects) {
    for (const category of subject.categories) {
      const concept = category.concepts.find((c) => c.id === id)
      if (concept) return concept
    }
  }
}

// 只有人工審核過的題目才會出現在練習中
export function practiceQuestions(concept: Concept): Question[] {
  return concept.questions.filter((q) => q.reviewed)
}

// 題目 ID → 題目與所屬概念，錯題本用來找回題目內容
export function questionIndex(map: TopicMap) {
  const index = new Map<string, { question: Question; conceptId: string; conceptTitle: string }>()
  for (const subject of map.subjects) {
    for (const category of subject.categories) {
      for (const concept of category.concepts) {
        for (const question of practiceQuestions(concept)) {
          index.set(question.id, { question, conceptId: concept.id, conceptTitle: concept.title })
        }
      }
    }
  }
  return index
}
