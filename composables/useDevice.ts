import { useMediaQuery, useMounted } from '@vueuse/core'

// 手機版操作：窄螢幕，或以觸控為主的裝置（平板也套用手機版操作）
// 掛載前一律視為桌面版：靜態產生的 HTML 是桌面版，hydration 時兩邊一致，掛載後再切換
export function useDevice() {
  const mounted = useMounted()
  const narrow = useMediaQuery('(max-width: 768px)')
  const coarse = useMediaQuery('(pointer: coarse)')
  const isMobile = computed(() => mounted.value && (narrow.value || coarse.value))
  return { isMobile }
}
