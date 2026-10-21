import { describe, expect, it } from 'vitest'
import {
  EXPORT_APP,
  EXPORT_VERSION,
  latestByQuestion,
  newAttempts,
  parseExport,
  summary,
  toExport,
  wrongQuestionIds,
} from '~/utils/progress'
import { attempt } from './fixtures'

describe('latestByQuestion', () => {
  it('每題只留最近一次作答，與紀錄順序無關', () => {
    const later = attempt('q1', true, '2026-10-21T02:00:00.000Z')
    const earlier = attempt('q1', false, '2026-10-21T01:00:00.000Z')
    expect(latestByQuestion([later, earlier]).get('q1')).toBe(later)
    expect(latestByQuestion([earlier, later]).get('q1')).toBe(later)
  })
})

describe('wrongQuestionIds', () => {
  it('只列出最近一次答錯的題目，最新的排前面', () => {
    const attempts = [
      attempt('q1', false, '2026-10-21T01:00:00.000Z'),
      attempt('q1', true, '2026-10-21T02:00:00.000Z'), // 後來答對，不算錯題
      attempt('q2', false, '2026-10-21T03:00:00.000Z'),
      attempt('q3', false, '2026-10-21T04:00:00.000Z'),
    ]
    expect(wrongQuestionIds(attempts)).toEqual(['q3', 'q2'])
  })
})

describe('summary', () => {
  it('沒有作答時答對率為 0，不會除以零', () => {
    expect(summary([])).toEqual({ total: 0, correct: 0, rate: 0 })
  })

  it('計算總數、答對數與答對率', () => {
    expect(summary([attempt('q1', true), attempt('q2', false)])).toEqual({ total: 2, correct: 1, rate: 0.5 })
  })
})

describe('匯出與匯入', () => {
  it('匯出時拿掉 IndexedDB 編號，匯入後內容相同', () => {
    const records = [{ ...attempt('q1', true), id: 7 }]
    const file = toExport(records, new Date('2026-10-21T00:00:00.000Z'))
    expect(file.attempts[0]).not.toHaveProperty('id')
    expect(parseExport(JSON.stringify(file))).toEqual(file.attempts)
  })

  it.each([
    ['不是 JSON', 'not json', '檔案不是有效的 JSON。'],
    ['別的網站的檔案', JSON.stringify({ app: 'other' }), '這不是本網站匯出的學習紀錄檔。'],
    ['版本不符', JSON.stringify({ app: EXPORT_APP, version: 99, attempts: [] }), '不支援的紀錄檔版本：99。'],
    [
      '紀錄缺欄位',
      JSON.stringify({ app: EXPORT_APP, version: EXPORT_VERSION, attempts: [{ questionId: 'q1' }] }),
      '紀錄檔內容格式不正確。',
    ],
    [
      '作答時間不是日期',
      JSON.stringify({
        app: EXPORT_APP,
        version: EXPORT_VERSION,
        attempts: [{ ...attempt('q1', true), answeredAt: '昨天' }],
      }),
      '紀錄檔內容格式不正確。',
    ],
  ])('%s時顯示可讀的錯誤訊息', (_, text, message) => {
    expect(() => parseExport(text)).toThrow(message)
  })

  it('匯入時略過已有的紀錄，以及檔案內重複的紀錄', () => {
    const existing = [attempt('q1', true, '2026-10-21T01:00:00.000Z')]
    const incoming = [
      attempt('q1', true, '2026-10-21T01:00:00.000Z'), // 已存在
      attempt('q2', false, '2026-10-21T02:00:00.000Z'),
      attempt('q2', false, '2026-10-21T02:00:00.000Z'), // 檔案內重複
      attempt('q1', false, '2026-10-21T03:00:00.000Z'), // 同一題、不同時間，算新紀錄
    ]
    expect(newAttempts(existing, incoming).map((a) => `${a.questionId}@${a.answeredAt}`)).toEqual([
      'q2@2026-10-21T02:00:00.000Z',
      'q1@2026-10-21T03:00:00.000Z',
    ])
  })
})
