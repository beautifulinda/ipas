// 題號分組（需求在 tests/features/題號分組.feature）：一個主題超過 GROUP_SIZE 題時，
// 題號每 GROUP_SIZE 題一組，一次只顯示一組，避免一整排題號看起來壓力很大

export const GROUP_SIZE = 10

export interface QuestionGroup {
  /** 這組第一題的位置（從 0 起算） */
  start: number
  /** 這組最後一題的下一個位置 */
  end: number
  /** 畫面上的組名，例如「21–30」 */
  label: string
}

/** 題數不超過 GROUP_SIZE 時不分組，回傳空陣列 */
export function questionGroups(count: number): QuestionGroup[] {
  if (count <= GROUP_SIZE) return []
  const groups: QuestionGroup[] = []
  for (let start = 0; start < count; start += GROUP_SIZE) {
    const end = Math.min(start + GROUP_SIZE, count)
    groups.push({ start, end, label: end - start === 1 ? `${end}` : `${start + 1}–${end}` })
  }
  return groups
}

/** 第 index 題（從 0 起算）屬於第幾組 */
export function groupOf(index: number): number {
  return Math.floor(index / GROUP_SIZE)
}
