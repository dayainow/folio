/**
 * Folio 딥링크 — Slack 「확인」 버튼 · 클라이언트 네비게이션
 */

export type FolioDeepLink =
  | { tab: 'journal'; date?: string; folder?: string }
  | { tab: 'docs'; docId?: string }
  | { tab: 'board'; taskId?: string }
  | { tab: 'process' }

export type FolioMainTab =
  | 'assistant'
  | 'projects'
  | 'journal'
  | 'docs'
  | 'board'
  | 'process'

export type FolioHashRoute = {
  tab: FolioMainTab
  journalSubTab?: 'journal-write' | 'journal-view'
  docsSubTab?: 'write' | 'view' | 'intake'
}

/**
 * 새로고침·공유 후에도 사용자가 보던 작업 맥락을 복원한다.
 * 과거 #write/#view/#intake 링크도 계속 열리도록 호환한다.
 */
export function parseFolioHash(hash: string): FolioHashRoute {
  const value = hash.replace(/^#/, '').replace(/^\//, '')
  switch (value) {
    case 'projects':
      return { tab: 'projects' }
    case 'journal/view':
    case 'view':
      return { tab: 'journal', journalSubTab: 'journal-view' }
    case 'journal/write':
    case 'write':
      return { tab: 'journal', journalSubTab: 'journal-write' }
    case 'docs/write':
      return { tab: 'docs', docsSubTab: 'write' }
    case 'docs/view':
      return { tab: 'docs', docsSubTab: 'view' }
    case 'docs/intake':
    case 'intake':
      return { tab: 'docs', docsSubTab: 'intake' }
    case 'board':
      return { tab: 'board' }
    case 'process':
      return { tab: 'process' }
    case 'today':
    default:
      return { tab: 'assistant' }
  }
}

export function buildFolioHash(
  tab: FolioMainTab,
  options: {
    journalSubTab?: 'journal-write' | 'journal-view'
    docsSubTab?: 'write' | 'view' | 'intake'
  } = {},
): string {
  if (tab === 'assistant') return '#today'
  if (tab === 'projects') return '#projects'
  if (tab === 'journal') {
    return options.journalSubTab === 'journal-view' ? '#journal/view' : '#journal/write'
  }
  if (tab === 'docs') return `#docs/${options.docsSubTab ?? 'view'}`
  if (tab === 'board') return '#board'
  return '#process'
}

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
  if (link.tab === 'journal' && link.folder) params.set('folder', link.folder)
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
  folder: string | null
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
    folder: params.get('folder'),
    docId: params.get('docId'),
    taskId: params.get('taskId'),
  }
}
