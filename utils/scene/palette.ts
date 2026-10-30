// 3D 地圖的配色：每座島一組主題。整體走極光夜空下的低多邊形風格：深藍海、偏深的自然色陸地
export const THEMES_3D = [
  {
    // 草原島
    land: ['#4f9a3c', '#45893a', '#5aa645', '#3f8034', '#4c9440'],
    landSide: '#2f5c2c',
    sand: '#d9cf98',
    rock: '#5e5a50',
    crown: '#2f7a3a',
    crownLight: '#4a9a48',
    pine: '#255f33',
    hill: '#56a043',
    mountain: '#7f8a8c',
  },
  {
    // 秋楓島
    land: ['#c99a3e', '#b98a34', '#d4a64a', '#ae7f30', '#c39440'],
    landSide: '#7a5424',
    sand: '#e6d6a2',
    rock: '#6a5340',
    crown: '#c4582c',
    crownLight: '#e07a3c',
    pine: '#9c4426',
    hill: '#cfa14a',
    mountain: '#8f7564',
  },
  {
    // 薰衣草島
    land: ['#8f82cf', '#8275c4', '#9a8edb', '#776aba', '#9285d2'],
    landSide: '#4f4590',
    sand: '#e4dcbc',
    rock: '#55506a',
    crown: '#5d4cb0',
    crownLight: '#7f6fd0',
    pine: '#4a3c98',
    hill: '#9b8fdc',
    mountain: '#8a86a8',
  },
]

export type Theme3D = (typeof THEMES_3D)[number]

export const SEA_COLOR = '#1f4f9a'
// 地平線附近的青綠色，遠方的海會淡進這個顏色
export const SKY_COLOR = '#1b6f7c'
// 浮空水晶岩：青綠色的晶面，頂上一小片草
export const CRYSTAL_COLOR = '#2a9fa8'
export const CRYSTAL_TOP = '#4f9a3c'
