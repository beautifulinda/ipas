// 逐題審核練習題草稿：先作答、再看答案與解析，通過的題目移到正式題庫並標記 reviewed: true
// 用法：npm run review            審核全部草稿
//       npm run review -- L113    只審核代碼開頭符合的概念（例如 L113、L11302）
import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { stdin as input, stdout as output } from 'node:process'

const MAP_FILE = 'data/map.json'
const DRAFT_FILE = 'data/drafts/questions.draft.json'
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const writeJson = (file, data) => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)

const map = readJson(MAP_FILE)
const draftFile = readJson(DRAFT_FILE)
const prefix = process.argv[2] ?? ''

const concepts = new Map()
for (const subject of map.subjects) {
  for (const category of subject.categories) {
    for (const concept of category.concepts) concepts.set(concept.id, concept)
  }
}

const queue = draftFile.drafts.filter((d) => d.conceptId.startsWith(prefix))
if (!queue.length) {
  console.log(prefix ? `沒有 ${prefix} 開頭的草稿。` : '目前沒有草稿。')
  process.exit(0)
}

// 輸入的每一行先排進佇列再依序取用，打字快或從檔案餵入時都不會漏行；輸入結束時回傳 null
const rl = createInterface({ input })
const lines = []
const waiters = []
let closed = false
rl.on('line', (line) => (waiters.length ? waiters.shift()(line) : lines.push(line)))
rl.on('close', () => {
  closed = true
  while (waiters.length) waiters.shift()(null)
})
function ask(prompt) {
  output.write(prompt)
  if (lines.length) return Promise.resolve(lines.shift())
  if (closed) return Promise.resolve(null)
  return new Promise((resolve) => waiters.push(resolve))
}

const bold = (text) => `\x1b[1m${text}\x1b[0m`
const green = (text) => `\x1b[32m${text}\x1b[0m`
const red = (text) => `\x1b[31m${text}\x1b[0m`
let approved = 0
let flagged = 0

console.log(`共 ${queue.length} 題草稿${prefix ? `（${prefix}）` : ''}。每題先作答，再決定是否通過。\n`)

for (const [index, draft] of queue.entries()) {
  const q = draft.question
  const concept = concepts.get(draft.conceptId)
  console.log(bold(`── 第 ${index + 1}/${queue.length} 題　${concept?.title ?? draft.conceptId}　難度 ${q.difficulty}　${q.id}`))
  if (draft.reviewNote) console.log(red(`上次備註：${draft.reviewNote}`))
  console.log(`\n${q.stem}\n`)
  for (const option of q.options) console.log(`  (${option.id}) ${option.text}`)

  const guess = ((await ask('\n你的答案（直接按 Enter 跳過作答）：')) ?? '').trim().toUpperCase()
  if (guess) console.log(guess === q.answer ? green('答對了！') : red(`答錯了，你選 ${guess}。`))
  console.log(`正確答案：${bold(q.answer)}\n解析：${q.explanation}\n`)

  const action = ((await ask('[a] 通過　[n] 需要修改（寫備註）　[s] 略過　[q] 結束：')) ?? 'q').trim().toLowerCase()
  if (action === 'q') break
  if (action === 'a') {
    if (!concept) {
      console.log(red(`找不到概念 ${draft.conceptId}，略過。`))
      continue
    }
    concept.questions.push({
      ...q,
      source: { ...q.source, note: 'LLM 輔助撰寫，作者審核通過' },
      reviewed: true,
    })
    draftFile.drafts = draftFile.drafts.filter((d) => d !== draft)
    approved += 1
  } else if (action === 'n') {
    draft.reviewNote = ((await ask('要修改的地方：')) ?? '').trim()
    flagged += 1
  }
  // 每處理一題就存檔，中途離開也不會遺失
  writeJson(MAP_FILE, map)
  writeJson(DRAFT_FILE, draftFile)
  console.log('')
}

rl.close()
console.log(`本次通過 ${approved} 題、標記待修改 ${flagged} 題，剩下 ${draftFile.drafts.length} 題草稿。`)
if (approved) console.log('記得執行 npm run validate 檢查，再 commit。')
