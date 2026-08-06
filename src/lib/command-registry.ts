/**
 * P64 — 커맨드 팔레트 레지스트리 · 최근 사용
 */
'use client'

import type { ShortcutId } from '@/lib/shortcuts'
import { formatBinding, loadShortcutBindings } from '@/lib/shortcuts'

export type CommandCategory =
  | 'navigate'
  | 'create'
  | 'search'
  | 'tools'
  | 'settings'
  | 'help'

export type CommandDef = {
  id: string
  title: string
  keywords: string[]
  category: CommandCategory
  /** 연결 단축키(있으면 힌트 표시) */
  shortcutId?: ShortcutId
  run: () => void
}

const RECENT_KEY = 'folio_command_recent_v1'
const RECENT_MAX = 8

export function loadRecentCommandIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const parsed = raw ? (JSON.parse(raw) as string[]) : []
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

export function pushRecentCommand(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const prev = loadRecentCommandIds().filter((x) => x !== id)
    const next = [id, ...prev].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigate: '이동',
  create: '작성',
  search: '검색',
  tools: '도구',
  settings: '설정',
  help: '도움말',
}

export type CommandHandlers = {
  openJournalTab: () => void
  openDocsTab: () => void
  openBoardTab: () => void
  openProcessTab: () => void
  openQuickCapture: () => void
  newDoc: () => void
  newTask: () => void
  focusSearch: () => void
  openAdvancedSearch: () => void
  openExport: () => void
  openReports: () => void
  openPlugins: () => void
  openShortcutSettings: () => void
  openHelp: () => void
  openGuide: () => void
  openThemeToggle?: () => void
}

export function buildCommands(h: CommandHandlers): CommandDef[] {
  return [
    {
      id: 'nav-journal',
      title: '일지 탭',
      keywords: ['journal', '일지', '작성'],
      category: 'navigate',
      run: h.openJournalTab,
    },
    {
      id: 'nav-docs',
      title: '문서 탭',
      keywords: ['docs', '문서', '열기'],
      category: 'navigate',
      run: h.openDocsTab,
    },
    {
      id: 'nav-board',
      title: '보드 탭',
      keywords: ['board', '칸반', '일정', '태스크'],
      category: 'navigate',
      run: h.openBoardTab,
    },
    {
      id: 'nav-process',
      title: '프로세스 탭',
      keywords: ['process', '게이트', 'beacon'],
      category: 'navigate',
      run: h.openProcessTab,
    },
    {
      id: 'create-journal',
      title: '일지 작성',
      keywords: ['새 일지', 'quick capture', 'journal'],
      category: 'create',
      shortcutId: 'new-journal',
      run: h.openQuickCapture,
    },
    {
      id: 'create-doc',
      title: '문서 열기 / 새 문서',
      keywords: ['새 문서', 'doc', 'create'],
      category: 'create',
      shortcutId: 'new-doc',
      run: h.newDoc,
    },
    {
      id: 'create-task',
      title: '태스크 생성',
      keywords: ['새 태스크', 'task', 'board'],
      category: 'create',
      shortcutId: 'new-task',
      run: h.newTask,
    },
    {
      id: 'search-global',
      title: '통합 검색',
      keywords: ['search', '검색', '찾기'],
      category: 'search',
      shortcutId: 'focus-search',
      run: h.focusSearch,
    },
    {
      id: 'search-advanced',
      title: '고급 검색',
      keywords: ['advanced', 'lunr', '필터'],
      category: 'search',
      run: h.openAdvancedSearch,
    },
    {
      id: 'tool-export',
      title: '내보내기 · 공유',
      keywords: ['export', 'pdf', '공유'],
      category: 'tools',
      shortcutId: 'open-export',
      run: h.openExport,
    },
    {
      id: 'tool-reports',
      title: '리포트',
      keywords: ['report', '주간', '월간'],
      category: 'tools',
      run: h.openReports,
    },
    {
      id: 'tool-plugins',
      title: '플러그인',
      keywords: ['plugin', '확장'],
      category: 'tools',
      shortcutId: 'open-plugins',
      run: h.openPlugins,
    },
    {
      id: 'settings-shortcuts',
      title: '설정 · 단축키',
      keywords: ['settings', '설정', 'shortcut', '단축키'],
      category: 'settings',
      run: h.openShortcutSettings,
    },
    {
      id: 'help-shortcuts',
      title: '단축키 목록',
      keywords: ['help', '도움말', '단축키'],
      category: 'help',
      shortcutId: 'help',
      run: h.openHelp,
    },
    {
      id: 'help-guide',
      title: '가이드 열기',
      keywords: ['guide', '온보딩'],
      category: 'help',
      shortcutId: 'open-guide',
      run: h.openGuide,
    },
  ]
}

export function filterCommands(commands: CommandDef[], query: string): CommandDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return commands
  return commands.filter((c) => {
    const hay = [c.title, ...c.keywords, c.category].join(' ').toLowerCase()
    return hay.includes(q) || q.split(/\s+/).every((part) => hay.includes(part))
  })
}

export function commandShortcutHint(cmd: CommandDef): string | null {
  if (!cmd.shortcutId) return null
  const b = loadShortcutBindings()[cmd.shortcutId]
  return b ? formatBinding(b) : null
}
