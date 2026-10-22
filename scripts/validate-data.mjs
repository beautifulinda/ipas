// 題庫檢查：格式、ID 不重複、答案在選項中，並擋下還沒人工審核（reviewed: false）的題目
// 用法：npm run validate（CI 也會執行，有錯誤時以非 0 結束）
//   --require-private：部署時使用，讀不到私人題庫（考古題）就失敗，避免部署出少了考古題的網站
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { checkPastPapers, findLeaks, privateBankError } from '../utils/pastPapers.ts'

const MAP_FILE = 'data/map.json'
const DRAFT_FILE = 'data/drafts/questions.draft.json'
// 官方公告試題放在私人 repo，本機與部署時放在 data/private/（公開 repo 不追蹤）；存在時一併檢查
const PRIVATE_FILE = 'data/private/past-papers.json'
const requirePrivate = process.argv.includes('--require-private')
const errors = []
const fail = (where, message) => errors.push(`${where}：${message}`)
const isText = (value) => typeof value === 'string' && value.trim().length > 0

function checkQuestion(q, where, { requireReviewed }) {
  if (!isText(q.id)) fail(where, '缺少題目 ID')
  if (q.type !== 'single') fail(where, `不支援的題型 ${q.type}`)
  if (!isText(q.stem)) fail(where, '缺少題幹')
  if (!Array.isArray(q.options) || q.options.length < 2) fail(where, '選項至少要兩個')
  else {
    const ids = q.options.map((o) => o.id)
    if (new Set(ids).size !== ids.length) fail(where, '選項代號重複')
    if (q.options.some((o) => !isText(o.id) || !isText(o.text))) fail(where, '選項缺少代號或內容')
    if (new Set(q.options.map((o) => o.text)).size !== q.options.length) fail(where, '選項內容重複')
    if (!ids.includes(q.answer)) fail(where, `答案 ${q.answer} 不在選項中`)
  }
  // 公告試題沒有官方解析，允許留空；自己寫的題目一定要有解析
  if (q.source?.type !== 'official-past' && !isText(q.explanation)) fail(where, '缺少解析')
  if (![1, 2, 3].includes(q.difficulty)) fail(where, '難度必須是 1、2 或 3')
  if (!['original', 'official-link', 'official-past'].includes(q.source?.type)) {
    fail(where, 'source.type 必須是 original、official-link 或 official-past')
  }
  if (q.source?.type === 'official-link' && !isText(q.source.url)) fail(where, 'official-link 題目必須附上官方網址')
  if (typeof q.reviewed !== 'boolean') fail(where, 'reviewed 必須是 true 或 false')
  else if (requireReviewed && !q.reviewed) fail(where, '尚未人工審核（reviewed: false），不可放進正式題庫')
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    fail(file, `無法讀取或不是有效的 JSON（${error.message}）`)
  }
}

const map = readJson(MAP_FILE)
const seen = new Map()
const unique = (id, where) => {
  if (seen.has(id)) fail(where, `ID ${id} 與 ${seen.get(id)} 重複`)
  else seen.set(id, where)
}

if (map) {
  if (!isText(map.disclaimer)) fail(MAP_FILE, '缺少免責聲明（disclaimer）')
  if (!Array.isArray(map.subjects) || !map.subjects.length) fail(MAP_FILE, '沒有任何科目')
  for (const subject of map.subjects ?? []) {
    const sWhere = `${MAP_FILE} ${subject.id}`
    unique(subject.id, sWhere)
    if (!isText(subject.title)) fail(sWhere, '缺少科目名稱')
    for (const category of subject.categories ?? []) {
      const cWhere = `${sWhere} › ${category.id}`
      unique(category.id, cWhere)
      if (!isText(category.title)) fail(cWhere, '缺少分類名稱')
      for (const concept of category.concepts ?? []) {
        const kWhere = `${cWhere} › ${concept.id}`
        unique(concept.id, kWhere)
        if (!isText(concept.title)) fail(kWhere, '缺少概念名稱')
        if (!isText(concept.summary)) fail(kWhere, '缺少概念說明')
        if (!Array.isArray(concept.keyPoints)) fail(kWhere, 'keyPoints 必須是陣列')
        if (!Array.isArray(concept.questions)) fail(kWhere, 'questions 必須是陣列（可為空）')
        for (const question of concept.questions ?? []) {
          const qWhere = `${kWhere} › ${question.id}`
          unique(question.id, qWhere)
          checkQuestion(question, qWhere, { requireReviewed: true })
        }
      }
    }
  }
}

// 草稿檔只檢查格式與 ID，不要求審核；所屬概念必須存在，ID 不可和正式題庫重複
const draftFile = readJson(DRAFT_FILE)
if (draftFile) {
  for (const draft of draftFile.drafts ?? []) {
    const where = `${DRAFT_FILE} ${draft.question?.id}`
    const owner = seen.get(draft.conceptId)
    if (!owner) fail(where, `所屬概念 ${draft.conceptId} 不存在`)
    unique(draft.question?.id, where)
    checkQuestion(draft.question ?? {}, where, { requireReviewed: false })
  }
}

// 官方公告試題只能放在私人題庫，不可出現在正式題庫或草稿
for (const [id, where] of seen) {
  if (id?.startsWith('past-') && !where.startsWith(PRIVATE_FILE)) fail(where, '官方公告試題不可放進會進 git 的檔案')
}
const missing = privateBankError(existsSync(PRIVATE_FILE))
if (missing && requirePrivate) fail(PRIVATE_FILE, missing)
if (!missing) {
  const items = readJson(PRIVATE_FILE)?.questions ?? []
  for (const item of items) {
    const where = `${PRIVATE_FILE} ${item.question?.id}`
    if (!seen.has(item.conceptId)) fail(where, `所屬概念 ${item.conceptId || '（未設定）'} 不存在`)
    unique(item.question?.id, where)
    checkQuestion(item.question ?? {}, where, { requireReviewed: true })
  }
  // 出處完整、考科和島對得上、出處不重複、同一題的官方答案一致
  if (map) for (const error of checkPastPapers(items, map)) fail(PRIVATE_FILE, error)
  // 公開 repo 的檔案與每次提交，都不可出現考古題的題目文字
  for (const error of findLeaks(publicSources(), items)) fail('公開 repo', error)
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
}

function publicSources() {
  const files = git('ls-files', '-z')
    .split('\0')
    .filter((file) => file && existsSync(file))
    .map((file) => ({ name: file, text: readFileSync(file, 'utf8') }))
  const commits = git('log', '--all', '-p', '--no-color', '--format=%x00%h')
    .split('\0')
    .filter(Boolean)
    .map((chunk) => ({ name: `提交 ${chunk.slice(0, chunk.indexOf('\n'))}`, text: chunk }))
  return [...files, ...commits]
}

if (errors.length) {
  console.error(`題庫檢查失敗，共 ${errors.length} 個問題：`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
const count = [...seen.keys()].filter((id) => id?.startsWith('q-') || id?.startsWith('past-')).length
console.log(`題庫檢查通過（正式題目、草稿與考古題共 ${count} 題）。`)
if (missing) console.log(`注意：${missing}，這次沒有檢查考古題。`)
