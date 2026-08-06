import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  resetCustomTemplates,
  upsertTemplate,
} from '@/lib/templates'
import {
  aggregateMs,
  formatDuration,
  getTaskTotalMs,
  isTimerRunning,
  loadTimeStore,
  startTimer,
  stopTimer,
} from '@/lib/time-tracking'
import {
  addBookmark,
  createFolder,
  isBookmarked,
  loadBookmarks,
  removeBookmarkByTarget,
  toggleBookmark,
} from '@/lib/bookmarks'
import { matchesModShift, resolveShortcut } from '@/lib/shortcuts'

describe('templates (P56)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetCustomTemplates()
  })

  it('lists builtin journal/doc/board templates', () => {
    expect(listTemplates('journal').length).toBeGreaterThanOrEqual(4)
    expect(listTemplates('doc').some((t) => t.name === 'Retrospective')).toBe(true)
    expect(listTemplates('board').some((t) => t.name === '버그')).toBe(true)
  })

  it('creates and deletes custom templates', () => {
    const t = createTemplate({ kind: 'journal', name: '커스텀', body: 'hi' })
    expect(getTemplate(t.id)?.name).toBe('커스텀')
    expect(deleteTemplate(t.id)).toBe(true)
    expect(getTemplate(t.id)).toBeUndefined()
  })

  it('rejects editing builtins', () => {
    expect(() =>
      upsertTemplate({ id: 'j-daily', kind: 'journal', name: 'x', body: 'y', builtin: true }),
    ).toThrow()
  })
})

describe('time-tracking (P56)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts stops and aggregates', () => {
    startTimer('task-1')
    expect(isTimerRunning('task-1')).toBe(true)
    vi.advanceTimersByTime(65_000)
    stopTimer('task-1')
    expect(isTimerRunning('task-1')).toBe(false)
    expect(getTaskTotalMs('task-1')).toBeGreaterThanOrEqual(65_000)
    expect(aggregateMs('day')).toBeGreaterThanOrEqual(65_000)
    expect(formatDuration(65_000)).toBe('1:05')
  })

  it('auto-stops previous when starting another', () => {
    startTimer('a')
    vi.advanceTimersByTime(10_000)
    startTimer('b')
    const store = loadTimeStore()
    expect(store.activeTaskId).toBe('b')
    expect(store.entries.some((e) => e.taskId === 'a')).toBe(true)
  })
})

describe('bookmarks (P56)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('toggles bookmarks and folders', () => {
    expect(toggleBookmark({ kind: 'doc', targetId: 'd1', title: 'Doc' })).toBe(true)
    expect(isBookmarked('doc', 'd1')).toBe(true)
    const folder = createFolder('업무')
    addBookmark({ kind: 'task', targetId: 't1', title: 'Task', folderId: folder.id })
    expect(loadBookmarks().items.length).toBe(2)
    removeBookmarkByTarget('doc', 'd1')
    expect(isBookmarked('doc', 'd1')).toBe(false)
  })
})

describe('shortcuts (P56/P64)', () => {
  it('resolves mod+shift keys', () => {
    const ev = {
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      key: 'n',
    } as KeyboardEvent
    expect(matchesModShift(ev, 'n')).toBe(true)
    // P64: Cmd+Shift+N = 새 문서 (이전 quick-journal은 Cmd+N)
    expect(resolveShortcut(ev)).toBe('new-doc')
  })
})
