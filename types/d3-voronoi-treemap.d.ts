// d3-voronoi-treemap 沒有附型別定義，只宣告這個專案用到的部分
declare module 'd3-voronoi-treemap' {
  import type { HierarchyNode } from 'd3-hierarchy'

  export interface VoronoiTreemap {
    <T>(root: HierarchyNode<T>): void
    clip(polygon: [number, number][]): VoronoiTreemap
    prng(random: () => number): VoronoiTreemap
    convergenceRatio(ratio: number): VoronoiTreemap
    maxIterationCount(count: number): VoronoiTreemap
  }

  export function voronoiTreemap(): VoronoiTreemap
}
