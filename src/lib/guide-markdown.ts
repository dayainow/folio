/**
 * 가이드 문서 마크다운 유틸 — 사이드바 TOC용 헤딩 추출
 */

export type GuideHeading = {
  id: string
  text: string
  level: 2 | 3
}

export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\uac00-\ud7a3\s-]/g, '')
    .replace(/\s+/g, '-')
}

/** `##` / `###` 헤딩만 추출 (코드펜스 제외 단순 파서) */
export function extractGuideHeadings(markdown: string): GuideHeading[] {
  const lines = markdown.split('\n')
  const out: GuideHeading[] = []
  let inFence = false
  const used = new Map<string, number>()

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = /^(#{2,3})\s+(.+)$/.exec(line)
    if (!m) continue
    const level = m[1].length as 2 | 3
    const text = m[2].replace(/\s+#+\s*$/, '').trim()
    let id = slugifyHeading(text)
    const n = (used.get(id) ?? 0) + 1
    used.set(id, n)
    if (n > 1) id = `${id}-${n}`
    out.push({ id, text, level })
  }
  return out
}
