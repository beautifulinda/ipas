import { openDB, type IDBPDatabase } from 'idb'
import {
  newAttempts,
  newDismissals,
  parseExport,
  toExport,
  wrongBook,
  type Attempt,
  type Dismissal,
} from '~/utils/progress'

// 作答紀錄與錯題本的移除紀錄只存在使用者瀏覽器的 IndexedDB，不上傳
const DB_NAME = 'ipas'
const ATTEMPTS = 'attempts'
const DISMISSALS = 'dismissals'

const attempts = ref<Attempt[]>([])
const dismissals = ref<Dismissal[]>([])
const ready = ref(false)
const storageError = ref('')
let dbPromise: Promise<IDBPDatabase> | undefined

function db() {
  dbPromise ??= openDB(DB_NAME, 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const store = database.createObjectStore(ATTEMPTS, { keyPath: 'id', autoIncrement: true })
        store.createIndex('questionId', 'questionId')
      }
      // 版本 2：錯題本改為使用者確認才移除，另存移除紀錄
      if (oldVersion < 2) database.createObjectStore(DISMISSALS, { keyPath: 'id', autoIncrement: true })
    },
  })
  return dbPromise
}

async function load() {
  try {
    const database = await db()
    attempts.value = await database.getAll(ATTEMPTS)
    dismissals.value = await database.getAll(DISMISSALS)
  } catch {
    // 無痕模式或瀏覽器停用儲存時，紀錄只留在這次開啟的頁面
    storageError.value = '瀏覽器無法儲存紀錄，關閉頁面後作答紀錄會消失。'
  } finally {
    ready.value = true
  }
}

async function record(attempt: Omit<Attempt, 'id'>) {
  try {
    const id = (await (await db()).add(ATTEMPTS, attempt)) as number
    attempts.value = [...attempts.value, { ...attempt, id }]
  } catch {
    attempts.value = [...attempts.value, attempt]
  }
}

// 使用者確認後，把題目移出錯題本
async function dismiss(questionId: string) {
  const dismissal = { questionId, dismissedAt: new Date().toISOString() }
  try {
    const id = (await (await db()).add(DISMISSALS, dismissal)) as number
    dismissals.value = [...dismissals.value, { ...dismissal, id }]
  } catch {
    dismissals.value = [...dismissals.value, dismissal]
  }
}

function exportFile() {
  const data = toExport(attempts.value, dismissals.value)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ipas-學習紀錄-${data.exportedAt.slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

// 回傳實際新增的筆數；格式錯誤時丟出可顯示給使用者的訊息
async function importFile(file: File) {
  const incoming = parseExport(await file.text())
  const freshAttempts = newAttempts(attempts.value, incoming.attempts)
  const freshDismissals = newDismissals(dismissals.value, incoming.dismissals)
  if (!freshAttempts.length && !freshDismissals.length) return 0
  try {
    const tx = (await db()).transaction([ATTEMPTS, DISMISSALS], 'readwrite')
    await Promise.all([
      ...freshAttempts.map((attempt) => tx.objectStore(ATTEMPTS).add(attempt)),
      ...freshDismissals.map((dismissal) => tx.objectStore(DISMISSALS).add(dismissal)),
      tx.done,
    ])
    const database = await db()
    attempts.value = await database.getAll(ATTEMPTS)
    dismissals.value = await database.getAll(DISMISSALS)
  } catch {
    attempts.value = [...attempts.value, ...freshAttempts]
    dismissals.value = [...dismissals.value, ...freshDismissals]
  }
  return freshAttempts.length + freshDismissals.length
}

const wrongQuestionIds = computed(() => wrongBook(attempts.value, dismissals.value))

let started = false

export function useRecords() {
  onMounted(() => {
    if (started) return
    started = true
    load()
  })
  return {
    attempts: readonly(attempts),
    dismissals: readonly(dismissals),
    wrongQuestionIds,
    ready: readonly(ready),
    storageError: readonly(storageError),
    record,
    dismiss,
    exportFile,
    importFile,
  }
}
