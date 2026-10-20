import type { Ref } from 'vue'
import { findPath, type MapNode } from '~/utils/mapTree'

// 把地圖的位置同步到網址（?at=節點ID）與瀏覽器歷史紀錄：
// - 手機的返回手勢（iPhone 從左緣右滑、Android 返回鍵）與瀏覽器上一頁，都會回到前一個位置
// - 網址可以直接分享，重新整理後回到同一個位置
// - 同層切換（方向鍵）只取代目前這筆，不會塞滿歷史紀錄
// 用 vue-router 而不直接操作 history：Nuxt 的路由也會監聽上一頁事件，繞過它會讓網址錯亂
export function useFocusHistory(focusId: Ref<string>, tree: MapNode) {
  const route = useRoute()
  const router = useRouter()

  // 這次開啟頁面後經過的位置，用來判斷「回上一層」能不能直接用瀏覽器的上一頁
  const stack: string[] = []
  let pointer = 0
  let syncing = false

  const isValid = (id: string) => findPath(tree, id).at(-1)?.id === id
  const parentOf = (id: string) => findPath(tree, id).at(-2)?.id
  const idFromRoute = () => {
    const at = route.query.at
    return typeof at === 'string' && isValid(at) ? at : tree.id
  }
  const queryFor = (id: string) => (id === tree.id ? {} : { at: id })

  function setFocus(id: string) {
    if (focusId.value === id) return
    syncing = true
    focusId.value = id
  }

  // 網址的位置在掛載後才套用，hydration 時畫面和靜態 HTML 一致
  onMounted(() => {
    setFocus(idFromRoute())
    stack.splice(0, stack.length, idFromRoute())
    pointer = 0
  })

  // 上一頁、下一頁或手動改網址
  watch(
    () => route.query.at,
    () => {
      const id = idFromRoute()
      if (id === focusId.value) return
      if (stack[pointer - 1] === id) pointer -= 1
      else if (stack[pointer + 1] === id) pointer += 1
      else {
        stack.splice(0, stack.length, id)
        pointer = 0
      }
      setFocus(id)
    },
  )

  // 在地圖上操作
  watch(focusId, (next, previous) => {
    if (syncing) {
      syncing = false
      return
    }
    if (stack[pointer - 1] === next) {
      // 回到前一個位置：直接用瀏覽器的上一頁，歷史紀錄才不會越疊越多
      pointer -= 1
      router.back()
    } else if (pointer > 0 && parentOf(next) === parentOf(previous)) {
      stack[pointer] = next
      router.replace({ query: queryFor(next) })
    } else {
      pointer += 1
      stack.length = pointer
      stack.push(next)
      router.push({ query: queryFor(next) })
    }
  })
}
