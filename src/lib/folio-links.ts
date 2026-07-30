/**
 * Folio 딥링크 — Slack 「확인」 버튼 · 클라이언트 네비게이션
 */

export type FolioDeepLink =
  | { tab: 'journal'; date?: string }
  | { tab: 'docs'; docId?: string }
  | { tab: 'board'; taskId?: string }
  | { tab: 'process' }

export function getFolioOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  const fromEnv =
    process.env.NEXT_PUBLIC_FOLIO_URL?.trim() ||
    process.env.FOLIO_PUBLIC_URL?.trim() ||
    ''
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return ''
}

export function buildFolioDeepLink(link: FolioDeepLink, origin?: string): string {
  const base = (origin ?? getFolioOrigin()).replace(/\/$/, '') || ''
  const params = new URLSearchParams()
  params.set('tab', link.tab)
  if (link.tab === 'journal' && link.date) params.set('date', link.date)
  if (link.tab === 'docs' && link.docId) params.set('docId', link.docId)
  if (link.tab === 'board' && link.taskId) params.set('taskId', link.taskId)
  const qs = params.toString()
  return base ? `${base}/?${qs}` : `/?${qs}`
}

export function parseFolioDeepLink(
  search: string,
): {
  tab: 'journal' | 'docs' | 'board' | 'process' | null
  date: string | null
  docId: string | null
  taskId: string | null
} {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const tabRaw = params.get('tab')
  const tab =
    tabRaw === 'journal' || tabRaw === 'docs' || tabRaw === 'board' || tabRaw === 'process'
      ? tabRaw
      : null
  return {
    tab,
    date: params.get('date'),
    docId: params.get('docId'),
    taskId: params.get('taskId'),
  }
}
