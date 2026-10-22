import { createSoundPlayer, loadSoundOn, saveSoundOn } from '~/utils/sound'
import type { CelebrationSound } from '~/utils/progression'

// 音效開關與播放；開關狀態在頁面與「學習紀錄」選單之間共用，掛載後才讀瀏覽器設定，避免 hydration 不一致
const soundOn = ref(true)
let loaded = false
const player = createSoundPlayer(() => {
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  return Context ? new Context() : undefined
})

// 隱私模式或封鎖網站資料時，連讀取 localStorage 都可能丟出錯誤
function storage() {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function useSound() {
  onMounted(() => {
    if (loaded) return
    loaded = true
    soundOn.value = loadSoundOn(storage())
  })

  function setSoundOn(on: boolean) {
    soundOn.value = on
    saveSoundOn(storage(), on)
  }

  function play(kind: CelebrationSound | undefined) {
    if (kind && soundOn.value) void player(kind)
  }

  return { soundOn: readonly(soundOn), setSoundOn, play }
}
