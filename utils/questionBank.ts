import type { Question, TopicMap } from '~/types/map'

export interface ExtraQuestion {
  conceptId: string
  question: Question
}

// 把額外的題目（本機的官方公告試題）併入對應的概念；找不到概念的題目略過
export function withExtraQuestions(map: TopicMap, extras: ExtraQuestion[]): TopicMap {
  if (!extras.length) return map
  const byConcept = new Map<string, Question[]>()
  for (const { conceptId, question } of extras) {
    byConcept.set(conceptId, [...(byConcept.get(conceptId) ?? []), question])
  }
  return {
    ...map,
    subjects: map.subjects.map((subject) => ({
      ...subject,
      categories: subject.categories.map((category) => ({
        ...category,
        concepts: category.concepts.map((concept) => ({
          ...concept,
          questions: [...concept.questions, ...(byConcept.get(concept.id) ?? [])],
        })),
      })),
    })),
  }
}
