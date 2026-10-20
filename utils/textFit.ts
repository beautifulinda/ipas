// SVG 文字不會自動換行，這裡用字元寬度估算（中文約 1em、英數約 0.6em）自行斷行

function charWidth(ch: string) {
  return /[\u0000-ÿ]/.test(ch) ? 0.6 : 1
}

function truncate(line: string, maxWidthEm: number) {
  let out = ''
  let width = 0
  // 保留 1em 給刪節號
  for (const ch of line) {
    const w = charWidth(ch)
    if (width + w > maxWidthEm - 1) break
    out += ch
    width += w
  }
  return `${out}…`
}

// 把文字切成最多 maxLines 行，每行寬度不超過 maxWidthEm；放不下時最後一行加刪節號
export function fitLines(text: string, maxWidthEm: number, maxLines: number): string[] {
  if (maxWidthEm < 2 || maxLines < 1) return []

  const lines: string[] = []
  let line = ''
  let width = 0
  for (const ch of text) {
    const w = charWidth(ch)
    if (width + w > maxWidthEm && line) {
      if (lines.length === maxLines - 1) return [...lines, truncate(line, maxWidthEm)]
      lines.push(line)
      line = ''
      width = 0
      if (ch === ' ') continue
    }
    line += ch
    width += w
  }
  if (line) lines.push(line)
  return lines
}
