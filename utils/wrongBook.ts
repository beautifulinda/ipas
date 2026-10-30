// 複習清單（原本的錯題本，加上自己標記不熟的題目）的分組：L11、L12 分開考，所以先分科目；
// 考古題再依梯次分開，算出「這次錯幾題／50」（只算錯題，不熟標記不算）
import type { Question, TopicMap } from '~/types/map'
import { practiceQuestions } from '~/utils/concepts'
import { reviewList } from '~/utils/progress'
import { compareExams, isPastPaper, PAPER_SIZE, paperLabel } from '~/utils/pastPapers'

export interface WrongItem {
  question: Question
  conceptId: string
  conceptTitle: string
  // 這題在這次考試的題號；自編題沒有
  number?: number
  // 在錯題本裡、自己標記不熟；兩個都是時都標
  wrong: boolean
  marked: boolean
}

export type ReviewFilter = 'all' | 'wrong' | 'marked'

export interface WrongGroup {
  key: string
  title: string
  items: WrongItem[]
  // 考古題才有：這次考試作答過幾題、一科共幾題
  answered?: number
  size?: number
}

export interface WrongSubject {
  id: string
  title: string
  // 這個科目的錯題數、不熟題數、兩種合計（同一題考過好幾次、同時是錯題又標記不熟都只算一題）
  wrongCount: number
  markedCount: number
  reviewCount: number
  groups: WrongGroup[]
}

// wrongIds 依錯題本的順序（最近答錯的在前）；answeredIds 是作答過的題目；markedIds 是標記不熟的題目（最近標記的在前）
export function wrongBookBySubject(
  map: TopicMap,
  wrongIds: readonly string[],
  answeredIds: ReadonlySet<string>,
  markedIds: readonly string[] = [],
): WrongSubject[] {
  const rank = new Map(reviewList(wrongIds, markedIds).map((id, i) => [id, i]))
  const wrongSet = new Set(wrongIds)
  const markedSet = new Set(markedIds)
  return map.subjects.map((subject) => {
    const papers = new Map<string, { session: string; paper: 1 | 2; group: WrongGroup }>()
    const original: WrongGroup = { key: 'original', title: '自編題', items: [] }
    const wrongInSubject = new Set<string>()
    const markedInSubject = new Set<string>()
    for (const category of subject.categories) {
      for (const concept of category.concepts) {
        for (const question of practiceQuestions(concept)) {
          const isWrong = wrongSet.has(question.id)
          const isMarked = markedSet.has(question.id)
          const item = { question, conceptId: concept.id, conceptTitle: concept.title, wrong: isWrong, marked: isMarked }
          if (isWrong) wrongInSubject.add(question.id)
          if (isMarked) markedInSubject.add(question.id)
          const listed = isWrong || isMarked
          if (!isPastPaper(question)) {
            if (listed) original.items.push(item)
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
                group: { key, title: paperLabel(exam.session, exam.paper), items: [], answered: 0, size: PAPER_SIZE },
              }
              papers.set(key, entry)
            }
            if (answeredIds.has(question.id)) entry.group.answered! += 1
            if (listed) entry.group.items.push({ ...item, number: exam.number })
          }
        }
      }
    }
    const byRank = (a: WrongItem, b: WrongItem) => rank.get(a.question.id)! - rank.get(b.question.id)!
    // 梯次由新到舊；自編題有要複習的題目才列出，排最後
    const groups = [...papers.values()]
      .sort((a, b) => compareExams({ ...b, number: 0 }, { ...a, number: 0 }))
      .map(({ group }) => group)
    if (original.items.length) groups.push(original)
    for (const group of groups) group.items.sort(byRank)
    const reviewCount = new Set([...wrongInSubject, ...markedInSubject]).size
    return {
      id: subject.id,
      title: subject.title,
      wrongCount: wrongInSubject.size,
      markedCount: markedInSubject.size,
      reviewCount,
      groups,
    }
  })
}

// 畫面上的文字：分頁「L11・複習 1」、梯次「錯 5／50（10%）・已作答 7 題」、自編題「錯 1 題」
export function subjectTabLabel(subject: WrongSubject) {
  return `${subject.id}・複習 ${subject.reviewCount}`
}

// 頁首的選單按鈕
export function recordMenuLabel(reviewCount: number) {
  return `學習紀錄（複習 ${reviewCount}）`
}

// 篩選按鈕「全部」「答錯 1」「不熟 1」
export function filterLabels(subject: WrongSubject): Record<ReviewFilter, string> {
  return { all: '全部', wrong: `答錯 ${subject.wrongCount}`, marked: `不熟 ${subject.markedCount}` }
}

export function filterItems(items: readonly WrongItem[], filter: ReviewFilter) {
  return filter === 'all' ? [...items] : items.filter((item) => item[filter])
}

// 每題旁的標示
export function itemTags(item: WrongItem) {
  return [item.wrong && '答錯', item.marked && '不熟'].filter((tag): tag is string => Boolean(tag))
}

export function groupScoreLabel(group: WrongGroup) {
  const count = group.items.filter((item) => item.wrong).length
  if (!group.size) return `錯 ${count} 題`
  return `錯 ${count}／${group.size}（${Math.round((count / group.size) * 100)}%）・已作答 ${group.answered} 題`
}

// 梯次沒有要複習的題目時，展開後顯示的文字
export function groupEmptyText(group: WrongGroup) {
  return group.answered ? '這次沒有要複習的題目。' : '還沒作答這次的題目。'
}
