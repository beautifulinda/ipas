import type { TopicMap } from '~/types/map'

export type MapLevel = 'root' | 'subject' | 'category' | 'concept'

// 地圖用的樹狀節點，只保留繪圖與導覽需要的欄位
export interface MapNode {
  id: string
  title: string
  level: MapLevel
  children?: MapNode[]
}

export const ROOT_ID = 'root'

export function toMapTree(map: TopicMap): MapNode {
  return {
    id: ROOT_ID,
    title: '全部科目',
    level: 'root',
    children: map.subjects.map((subject) => ({
      id: subject.id,
      title: subject.title,
      level: 'subject',
      children: subject.categories.map((category) => ({
        id: category.id,
        title: category.title,
        level: 'category',
        children: category.concepts.map((concept) => ({
          id: concept.id,
          title: concept.title,
          level: 'concept',
        })),
      })),
    })),
  }
}

// 從根節點到指定節點的路徑；找不到時回傳只含根節點的路徑
export function findPath(tree: MapNode, id: string): MapNode[] {
  if (tree.id === id) return [tree]
  for (const child of tree.children ?? []) {
    const path = findPath(child, id)
    if (path[path.length - 1].id === id) return [tree, ...path]
  }
  return [tree]
}
