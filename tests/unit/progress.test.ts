import { describe, expect, it } from 'vitest'
import {
  EXPORT_APP,
  EXPORT_VERSION,
  latestByQuestion,
  markedQuestions,
  newAttempts,
  newDismissals,
  newMarks,
  parseExport,
  reviewList,
  shouldAskDismiss,
  summary,
  toExport,
  wrongBook,
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

describe('wrongBook', () => {
  it('答錯過的題目都在錯題本，後來答對也不會自動移出；最近答錯的排前面', () => {
    const attempts = [
      attempt('q1', false, '2026-10-21T01:00:00.000Z'),
      attempt('q1', true, '2026-10-21T02:00:00.000Z'),
      attempt('q2', false, '2026-10-21T03:00:00.000Z'),
      attempt('q3', true, '2026-10-21T04:00:00.000Z'),
    ]
    expect(wrongBook(attempts)).toEqual(['q2', 'q1'])
  })

  it('移除後就不在錯題本；移除後又答錯則重新進入', () => {
    const attempts = [attempt('q1', false, '2026-10-21T01:00:00.000Z')]
    const dismissals = [{ questionId: 'q1', dismissedAt: '2026-10-21T02:00:00.000Z' }]
    expect(wrongBook(attempts, dismissals)).toEqual([])
    expect(wrongBook([...attempts, attempt('q1', false, '2026-10-21T03:00:00.000Z')], dismissals)).toEqual(['q1'])
  })

  it('只有答對錯題本裡的題目時才詢問是否移除', () => {
    const attempts = [attempt('q1', false, '2026-10-21T01:00:00.000Z')]
    expect(shouldAskDismiss('q1', true, attempts, [])).toBe(true)
    expect(shouldAskDismiss('q1', false, attempts, [])).toBe(false)
    expect(shouldAskDismiss('q2', true, attempts, [])).toBe(false)
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
  const dismissal = { questionId: 'q1', dismissedAt: '2026-10-21T05:00:00.000Z' }
  const mark = { questionId: 'q2', marked: true, markedAt: '2026-10-21T06:00:00.000Z' }

  it('匯出時拿掉 IndexedDB 編號，匯入後內容相同（含錯題本的移除紀錄與不熟標記）', () => {
    const file = toExport(
      [{ ...attempt('q1', true), id: 7 }],
      [{ ...dismissal, id: 3 }],
      [{ ...mark, id: 5 }],
      new Date('2026-10-21'),
    )
    expect(file.attempts[0]).not.toHaveProperty('id')
    expect(file.dismissals[0]).not.toHaveProperty('id')
    expect(file.marks[0]).not.toHaveProperty('id')
    expect(parseExport(JSON.stringify(file))).toEqual({
      attempts: file.attempts,
      dismissals: file.dismissals,
      marks: file.marks,
    })
  })

  it('仍可匯入版本 1 的檔案（沒有移除紀錄與標記）', () => {
    const v1 = { app: EXPORT_APP, version: 1, exportedAt: '2026-10-20', attempts: [attempt('q1', false)] }
    expect(parseExport(JSON.stringify(v1))).toMatchObject({ dismissals: [], marks: [] })
  })

  it('仍可匯入版本 2 的檔案（沒有標記）', () => {
    const v2 = { app: EXPORT_APP, version: 2, exportedAt: '2026-10-26', attempts: [], dismissals: [dismissal] }
    expect(parseExport(JSON.stringify(v2))).toMatchObject({ dismissals: [dismissal], marks: [] })
  })

  it.each([
    ['不是 JSON', 'not json', '檔案不是有效的 JSON。'],
    ['別的網站的檔案', JSON.stringify({ app: 'other' }), '這不是本網站匯出的學習紀錄檔。'],
    ['版本不符', JSON.stringify({ app: EXPORT_APP, version: 99, attempts: [] }), '不支援的紀錄檔版本：99。'],
    [
      '紀錄缺欄位',
      JSON.stringify({
        app: EXPORT_APP,
        version: EXPORT_VERSION,
        attempts: [{ questionId: 'q1' }],
        dismissals: [],
        marks: [],
      }),
      '紀錄檔內容格式不正確。',
    ],
    [
      '作答時間不是日期',
      JSON.stringify({
        app: EXPORT_APP,
        version: EXPORT_VERSION,
        attempts: [{ ...attempt('q1', true), answeredAt: '昨天' }],
        dismissals: [],
        marks: [],
      }),
      '紀錄檔內容格式不正確。',
    ],
    [
      '版本 2 缺少移除紀錄',
      JSON.stringify({ app: EXPORT_APP, version: 2, attempts: [] }),
      '紀錄檔內容格式不正確。',
    ],
    [
      '版本 3 缺少標記',
      JSON.stringify({ app: EXPORT_APP, version: EXPORT_VERSION, attempts: [], dismissals: [] }),
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
    expect(newDismissals([dismissal], [dismissal, { ...dismissal, questionId: 'q2' }])).toEqual([
      { ...dismissal, questionId: 'q2' },
    ])
    // 同一題同一時間，標記和拿掉是不同的紀錄
    expect(newMarks([mark], [mark, { ...mark, marked: false }])).toEqual([{ ...mark, marked: false }])
  })
})

describe('不熟標記', () => {
  const at = (minute: number) => `2026-10-30T01:${String(minute).padStart(2, '0')}:00.000Z`

  it('每題以最後一筆為準，最近標記的排前面', () => {
    const marks = [
      { questionId: 'a', marked: true, markedAt: at(1) },
      { questionId: 'b', marked: true, markedAt: at(2) },
      { questionId: 'a', marked: false, markedAt: at(3) }, // 我懂了
      { questionId: 'c', marked: true, markedAt: at(4) },
    ]
    expect(markedQuestions(marks)).toEqual(['c', 'b'])
  })

  it('複習清單先列錯題，再列只有標記的題目，同一題只出現一次', () => {
    expect(reviewList(['w1', 'both'], ['m1', 'both'])).toEqual(['w1', 'both', 'm1'])
  })
})
