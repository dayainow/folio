/**
 * P58 — 일지 경로 파싱 (서버·클라이언트 공용, storage 의존 없음)
 */

export function journalPath(folderSlug: string, journalDate: string): string {
  return `/journal/${encodeURIComponent(folderSlug)}/${journalDate}`
}

export function parseJournalPath(segments: string[]): {
  folderSlug: string | null
  date: string | null
} {
  if (segments.length === 0) return { folderSlug: null, date: null }
  if (segments.length === 1) {
    const s = segments[0]
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { folderSlug: null, date: s }
    return { folderSlug: s, date: null }
  }
  const date = segments[segments.length - 1]
  const folderSlug = segments.slice(0, -1).join('/')
  return {
    folderSlug: decodeURIComponent(folderSlug),
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
  }
}
