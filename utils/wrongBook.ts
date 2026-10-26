// 錯題本的分組：L11、L12 分開考，所以先分科目；考古題再依梯次分開，算出「這次錯幾題／50」
import type { Question, TopicMap } from '~/types/map'
import { practiceQuestions } from '~/utils/concepts'
import { compareExams, isPastPaper, PAPER_SIZE, paperLabel } from '~/utils/pastPapers'

export interface WrongItem {
  question: Question
  conceptId: string
  conceptTitle: string
  // 這題在這次考試的題號；自編題沒有
  number?: number
}

export interface WrongGroup {
  key: string
  title: string
  wrong: WrongItem[]
  // 考古題才有：這次考試作答過幾題、一科共幾題
  answered?: number
  size?: number
}

export interface WrongSubject {
  id: string
  title: string
  // 這個科目的錯題數（同一題考過好幾次只算一題）
  wrongCount: number
  groups: WrongGroup[]
}

// wrongIds 依錯題本的順序（最近答錯的在前）；answeredIds 是作答過的題目
export function wrongBookBySubject(
  map: TopicMap,
  wrongIds: readonly string[],
  answeredIds: ReadonlySet<string>,
): WrongSubject[] {
  const rank = new Map(wrongIds.map((id, i) => [id, i]))
  return map.subjects.map((subject) => {
    const papers = new Map<string, { session: string; paper: 1 | 2; group: WrongGroup }>()
    const original: WrongGroup = { key: 'original', title: '自編題', wrong: [] }
    const wrongInSubject = new Set<string>()
    for (const category of subject.categories) {
      for (const concept of category.concepts) {
        for (const question of practiceQuestions(concept)) {
          const item = { question, conceptId: concept.id, conceptTitle: concept.title }
          const isWrong = rank.has(question.id)
          if (isWrong) wrongInSubject.add(question.id)
          if (!isPastPaper(question)) {
            if (isWrong) original.wrong.push(item)
            continue
          }
          // 同一題在不同場次考過時，每一次都算
          for (const exam of question.source.exams ?? []) {
            const key = `${exam.session}-${exam.paper}`
            let entry = papers.get(key)
            if (!entry) {
              entry = {
                session: exam.session,
                paper: exam.paper,
                group: { key, title: paperLabel(exam.session, exam.paper), wrong: [], answered: 0, size: PAPER_SIZE },
              }
              papers.set(key, entry)
            }
            if (answeredIds.has(question.id)) entry.group.answered! += 1
            if (isWrong) entry.group.wrong.push({ ...item, number: exam.number })
          }
        }
      }
    }
    const byRank = (a: WrongItem, b: WrongItem) => rank.get(a.question.id)! - rank.get(b.question.id)!
    // 梯次由新到舊；自編題有錯題才列出，排最後
    const groups = [...papers.values()]
      .sort((a, b) => compareExams({ ...b, number: 0 }, { ...a, number: 0 }))
      .map(({ group }) => group)
    if (original.wrong.length) groups.push(original)
    for (const group of groups) group.wrong.sort(byRank)
    return { id: subject.id, title: subject.title, wrongCount: wrongInSubject.size, groups }
  })
}

// 畫面上的文字：分頁「L11・錯 1」、梯次「錯 5／50（10%）・已作答 7 題」、自編題「錯 1 題」
export function subjectTabLabel(subject: WrongSubject) {
  return `${subject.id}・錯 ${subject.wrongCount}`
}

export function groupScoreLabel(group: WrongGroup) {
  const count = group.wrong.length
  if (!group.size) return `錯 ${count} 題`
  return `錯 ${count}／${group.size}（${Math.round((count / group.size) * 100)}%）・已作答 ${group.answered} 題`
}

// 梯次沒有錯題時，展開後顯示的文字
export function groupEmptyText(group: WrongGroup) {
  return group.answered ? '這次沒有錯題。' : '還沒作答這次的題目。'
}
