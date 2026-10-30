// 3D 地圖的配色：每座島一組主題
export const THEMES_3D = [
  {
    // 草原島
    land: ['#7fcf5a', '#6cc24c', '#8edb6a', '#62b444', '#79cb56'],
    landSide: '#4e9a36',
    sand: '#f3dc9b',
    rock: '#a9784a',
    crown: '#3fa34d',
    crownLight: '#5cbf55',
    pine: '#2f7d43',
    hill: '#7fd05e',
    mountain: '#9aa7b8',
  },
  {
    // 秋楓島
    land: ['#f2b84b', '#e8a93c', '#f6c45f', '#df9c33', '#f0bd55'],
    landSide: '#c98a2a',
    sand: '#fbeac0',
    rock: '#b8693a',
    crown: '#e86a32',
    crownLight: '#ff9a4f',
    pine: '#c9502a',
    hill: '#f6c96a',
    mountain: '#c98d6a',
  },
  {
    // 薰衣草島
    land: ['#b9a2fb', '#ae95f5', '#c6b3ff', '#a48bee', '#bfaaff'],
    landSide: '#8d6fe0',
    sand: '#ffeec2',
    rock: '#a8683a',
    crown: '#7b5bd6',
    crownLight: '#a58bf0',
    pine: '#6a4bc4',
    hill: '#c9b6ff',
    mountain: '#b3a6d6',
  },
]

export type Theme3D = (typeof THEMES_3D)[number]

export const SEA_COLOR = '#3fa7d6'
export const SKY_COLOR = '#bfe8f7'
