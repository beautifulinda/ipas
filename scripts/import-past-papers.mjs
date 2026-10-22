// 把 markitdown 轉好的 iPAS 公告試題 Markdown 解析成題目資料，輸出到 data/private/（私人 repo ipas-past-papers 的本機資料夾，不進公開 repo）
// 用法：node scripts/import-past-papers.mjs <試題 Markdown 資料夾> [概念對照檔]
//   概念對照檔：{ "115-S3-1-01": "L11302", ... }，沒有提供時 conceptId 留空
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const NOTE = '官方公告試題，試題著作權屬經濟部產業人才能力鑑定（iPAS）。只放在私人 repo，不可放進公開 repo。'
const [dir, mappingFile] = process.argv.slice(2)
if (!dir) {
  console.error('用法：node scripts/import-past-papers.mjs <試題 Markdown 資料夾> [概念對照檔]')
  process.exit(1)
}
const mapping = mappingFile && existsSync(mappingFile) ? JSON.parse(readFileSync(mappingFile, 'utf8')) : {}

// 頁首、頁尾與表頭，解析前先移除
const NOISE = [/^第\s*\d+\s*頁/, /能力鑑定【公告試題】/, /^第[一二]科：/, /^考試日期/, /^答\s*案$/, /^題\s*目$/, /^一、選擇題/, /^---$/]

function parsePaper(text) {
  const body = text.replace(/^---[\s\S]*?\n---\n/, '')
  const lines = body
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line && !NOISE.some((re) => re.test(line)))

  // 答案欄的字母在 PDF 轉檔後，有時在題號前一行、有時被擠進題幹第二、三行之間，
  // 但出現順序和題號一致：第 k 個單獨的 A～D 就是第 k 題的答案
  const questions = []
  const answers = []
  let current = null
  let expected = 1
  for (const line of lines) {
    // 少數答案是全形字母（Ｃ），轉成半形
    if (/^[A-DＡ-Ｄ]$/.test(line)) {
      answers.push(line.normalize('NFKC'))
      continue
    }
    const start = line.match(/^(\d{1,2})\.\s*(.*)$/)
    if (start && Number(start[1]) === expected) {
      current = { number: expected, text: start[2] }
      questions.push(current)
      expected += 1
      continue
    }
    if (current) current.text += line
  }
  if (answers.length !== questions.length) {
    throw new Error(`答案數（${answers.length}）與題數（${questions.length}）不一致`)
  }
  questions.forEach((q, i) => (q.answer = answers[i]))

  return questions.map((q) => {
    // 中文斷行直接接起來；英文單字被斷行時中間會少空白，影響不大
    const parts = q.text.split(/\(([A-D])\)/)
    const stem = parts[0].trim()
    const options = []
    for (let i = 1; i < parts.length; i += 2) {
      options.push({ id: parts[i], text: parts[i + 1].trim().replace(/[；;]$/, '').trim() })
    }
    return { number: q.number, answer: q.answer, stem, options }
  })
}

const files = readdirSync(dir).filter((f) => /^iPAS初級 .*公告試題\.md$/.test(f)).sort()
const result = []
const problems = []
for (const file of files) {
  const [, session, subjectWord] = file.match(/iPAS初級 (\S+) 第([一二])科/) ?? []
  const subject = subjectWord === '一' ? 1 : 2
  const questions = parsePaper(readFileSync(join(dir, file), 'utf8'))
  if (questions.length !== 50) problems.push(`${file}：解析出 ${questions.length} 題（應為 50 題）`)
  for (const q of questions) {
    const id = `${session}-${subject}-${String(q.number).padStart(2, '0')}`
    const where = `${session} 第${subjectWord}科 第 ${q.number} 題`
    const ids = q.options.map((o) => o.id).join('')
    if (ids !== 'ABCD') problems.push(`${where}：選項為 ${ids || '無'}`)
    if (/下圖|如圖|下表|如表/.test(q.stem)) problems.push(`${where}：題目可能含圖表，請對照原 PDF`)
    result.push({
      conceptId: mapping[id] ?? '',
      question: {
        id: `past-${id}`,
        type: 'single',
        stem: q.stem,
        options: q.options,
        answer: q.answer,
        explanation: '',
        difficulty: 2,
        source: { type: 'official-past', exams: [{ session, paper: subject, number: q.number }] },
        reviewed: true,
      },
    })
  }
}

mkdirSync('data/private', { recursive: true })
writeFileSync(
  'data/private/past-papers.json',
  `${JSON.stringify({ note: NOTE, questions: result }, null, 2)}\n`,
)
console.log(`解析 ${files.length} 份試卷、${result.length} 題，寫入 data/private/past-papers.json`)
const unmapped = result.filter((r) => !r.conceptId).length
if (unmapped) console.log(`尚未對應概念：${unmapped} 題`)
if (problems.length) {
  console.log(`需要注意 ${problems.length} 處：`)
  for (const p of problems) console.log(`- ${p}`)
}
