// 地圖的按鍵規則（需求在 tests/features/鍵盤作答.feature）：地圖模式與作答模式集中在這裡判斷，
// 再呼叫地圖（IslandMap3D 的 defineExpose）或首頁提供的操作
export interface MapControls {
  goUp: () => void
  goSibling: (step: number) => void
}

interface Options {
  // 地圖畫面沒有顯示（清單模式、不支援 WebGL）時是 undefined，按鍵不處理
  map: Ref<MapControls | undefined>
  // 目前是否聚焦在主題（城鎮）上，才可以按 Enter 進入作答
  atConcept: Ref<boolean>
  answering: Ref<boolean>
  enter: () => void
  leave: () => void
}

export function useMapKeyboard({ map, atConcept, answering, enter, leave }: Options) {
  // 最近一次是用鍵盤操作；改用滑鼠或觸控就變回 false，鍵盤提示框只在用鍵盤時顯示
  const usingKeyboard = ref(false)

  function onKeydown(event: KeyboardEvent) {
    usingKeyboard.value = true
    // 題目已經處理過的按鍵（換選項、換題）不再處理；換題時舊的選項可能已經從畫面移除，認不出它原本在面板裡
    if (event.defaultPrevented || !map.value) return
    const target = event.target instanceof Element ? event.target : undefined
    const typing = target?.closest('input, textarea, select, [contenteditable="true"]')
    const inPanel = target?.closest('[data-no-map-keys]')
    if (event.key === 'Escape') {
      // 作答中按 Esc：回到地圖模式，停在同一個主題；再按一次才回上一層。面板外的輸入框裡按 Esc 不動地圖
      if (answering.value) leave()
      else if (!typing || inPanel) map.value.goUp()
      return
    }
    // 在輸入框或面板（data-no-map-keys）裡按鍵時，不切換地圖
    if (typing || inPanel) return
    if (event.key === 'Enter') {
      // 焦點在按鈕或連結上時，Enter 是按那個按鈕
      if (atConcept.value && !target?.closest('button, a')) {
        event.preventDefault()
        enter()
      }
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      map.value.goSibling(-1)
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      map.value.goSibling(1)
    }
  }

  function onPointerDown() {
    usingKeyboard.value = false
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('pointerdown', onPointerDown)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('pointerdown', onPointerDown)
  })

  return { usingKeyboard: readonly(usingKeyboard) }
}
