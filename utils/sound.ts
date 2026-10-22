import type { CelebrationSound } from '~/utils/progression'

// 升級音效：用瀏覽器內建的 Web Audio 合成，不下載音檔。
// 帳篷兩個音、房子三個音、城堡／插旗／燈塔是號角琶音，最後都有幾聲亮晶晶的尾音

const SOUND_KEY = 'ipas:sound'

// 音效預設開；使用者在「學習紀錄」選單關掉後記在瀏覽器（作者 2026-10-22 決定）
export function loadSoundOn(storage: Pick<Storage, 'getItem'> | undefined) {
  try {
    return storage?.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function saveSoundOn(storage: Pick<Storage, 'setItem'> | undefined, on: boolean) {
  try {
    storage?.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    // 瀏覽器不允許儲存時，這次造訪仍然有效，只是下次會回到預設
  }
}

const TUNES: Record<CelebrationSound, { notes: number[]; hold: number; sparkles: number }> = {
  chime2: { notes: [1318.5, 1568], hold: 0.5, sparkles: 2 },
  chime3: { notes: [1046.5, 1318.5, 1568], hold: 0.6, sparkles: 4 },
  fanfare: { notes: [523.25, 659.25, 783.99, 1046.5], hold: 0.9, sparkles: 6 },
}

// 只用到 AudioContext 的這幾個功能，測試時可以換成假的
export type AudioContextLike = Pick<AudioContext, 'state' | 'currentTime' | 'destination' | 'resume' | 'createOscillator' | 'createGain'>

// 回傳的 play 在瀏覽器還不允許出聲（使用者還沒點過頁面）或不支援時，安靜地回傳 false，不會丟出錯誤
export function createSoundPlayer(createContext: () => AudioContextLike | undefined) {
  let context: AudioContextLike | undefined

  return async function play(kind: CelebrationSound) {
    try {
      context ??= createContext()
      if (!context) return false
      if (context.state !== 'running') await context.resume().catch(() => undefined)
      if (context.state !== 'running') return false
      schedule(context, TUNES[kind])
      return true
    } catch {
      return false
    }
  }
}

function schedule(context: AudioContextLike, tune: (typeof TUNES)[CelebrationSound]) {
  const now = context.currentTime
  const master = context.createGain()
  master.gain.value = 0.18
  master.connect(context.destination)
  tune.notes.forEach((frequency, i) => {
    const start = now + i * 0.11
    const hold = i === tune.notes.length - 1 ? tune.hold : 0.16
    // 三角波當主音，疊一點方波讓聲音亮一些
    for (const [type, detune, peak] of [['triangle', 0, 0.6], ['square', 6, 0.15]] as const) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = type
      oscillator.frequency.value = frequency
      oscillator.detune.value = detune
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(peak, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + hold)
      oscillator.connect(gain).connect(master)
      oscillator.start(start)
      oscillator.stop(start + hold + 0.05)
    }
  })
  for (let i = 0; i < tune.sparkles; i++) {
    const start = now + tune.notes.length * 0.11 + i * 0.07
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 1800 + ((i * 677) % 1600)
    gain.gain.setValueAtTime(0.22, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
    oscillator.connect(gain).connect(master)
    oscillator.start(start)
    oscillator.stop(start + 0.3)
  }
}
