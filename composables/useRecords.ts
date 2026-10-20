import { openDB, type IDBPDatabase } from 'idb'
import { newAttempts, parseExport, toExport, type Attempt } from '~/utils/progress'

// 作答紀錄只存在使用者瀏覽器的 IndexedDB，不上傳
const DB_NAME = 'ipas'
const STORE = 'attempts'

const attempts = ref<Attempt[]>([])
const ready = ref(false)
const storageError = ref('')
let dbPromise: Promise<IDBPDatabase> | undefined

function db() {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(database) {
      const store = database.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      store.createIndex('questionId', 'questionId')
    },
  })
  return dbPromise
}

async function load() {
  try {
    attempts.value = await (await db()).getAll(STORE)
  } catch {
    // 無痕模式或瀏覽器停用儲存時，紀錄只留在這次開啟的頁面
    storageError.value = '瀏覽器無法儲存紀錄，關閉頁面後作答紀錄會消失。'
  } finally {
    ready.value = true
  }
}

async function record(attempt: Omit<Attempt, 'id'>) {
  try {
    const id = (await (await db()).add(STORE, attempt)) as number
    attempts.value = [...attempts.value, { ...attempt, id }]
  } catch {
    attempts.value = [...attempts.value, attempt]
  }
}

function exportFile() {
  const data = toExport(attempts.value)
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
  const fresh = newAttempts(attempts.value, incoming)
  if (!fresh.length) return 0
  try {
    const tx = (await db()).transaction(STORE, 'readwrite')
    await Promise.all([...fresh.map((attempt) => tx.store.add(attempt)), tx.done])
    attempts.value = await (await db()).getAll(STORE)
  } catch {
    attempts.value = [...attempts.value, ...fresh]
  }
  return fresh.length
}

let started = false

export function useRecords() {
  onMounted(() => {
    if (started) return
    started = true
    load()
  })
  return {
    attempts: readonly(attempts),
    ready: readonly(ready),
    storageError: readonly(storageError),
    record,
    exportFile,
    importFile,
  }
}
