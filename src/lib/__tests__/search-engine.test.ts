/**
 * P52 — 검색 엔진 · 저장 검색 · 내보내기 테스트
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  highlightText,
  parseSearchQuery,
  runAdvancedSearch,
} from '@/lib/search-engine'
import {
  __resetSavedSearchesForTests,
  BUILTIN_SEARCH_PRESETS,
  deleteSavedSearch,
  listSavedSearches,
  listSearchHistory,
  pushSearchHistory,
  saveSearch,
} from '@/lib/saved-searches'
import { searchHitsToCsv, searchHitsToJson } from '@/lib/search-export'
import type { JournalEntry } from '@/lib/journal'
import type { DocEntry } from '@/lib/docs'
import type { Task } from '@/lib/board'

const journals: Record<string, JournalEntry> = {
  '2026-08-01': {
    date: '2026-08-01',
    content: '# Deploy\n배포 TODO 완료',
    tags: ['배포', 'ops'],
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
  '2026-08-03': {
    date: '2026-08-03',
    content: '미팅 노트 API 설계',
    tags: ['meeting'],
    updatedAt: '2026-08-03T10:00:00.000Z',
  },
}

const docs: DocEntry[] = [
  {
    id: 'd1',
    title: 'API Guide',
    content: 'REST API WIP draft',
    category: 'API',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  },
]

const tasks: Task[] = [
  {
    id: 't1',
    title: '검색 고도화',
    description: 'Lunr AND OR 지원',
    status: 'in_progress',
    priority: 'high',
    tags: ['search'],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
  },
  {
    id: 't2',
    title: '문서 정리',
    description: 'draft 정리',
    status: 'backlog',
    priority: 'low',
    tags: ['docs'],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
]

describe('parseSearchQuery', () => {
  it('parses boolean phrase wildcard and regex', () => {
    const a = parseSearchQuery('tag:배포 AND "TODO"')
    expect(a.lunrQuery).toContain('tags:배포')
    expect(a.lunrQuery).toContain('"TODO"')

    const b = parseSearchQuery('title:API*')
    expect(b.lunrQuery).toContain('title:API*')
    expect(b.fieldBoost).toContain('title')

    const c = parseSearchQuery('hello /WIP/i')
    expect(c.regex?.test('x WIP y')).toBe(true)
  })
})

describe('runAdvancedSearch', () => {
  it('finds by tag and filters status', () => {
    const r = runAdvancedSearch('tag:배포', journals, docs, tasks, {
      sources: ['journal'],
      sort: 'relevance',
    })
    expect(r.total).toBeGreaterThan(0)
    expect(r.journals.some((h) => h.date === '2026-08-01')).toBe(true)
  })

  it('filters in_progress tasks', () => {
    const r = runAdvancedSearch('', journals, docs, tasks, {
      sources: ['board'],
      status: ['in_progress'],
      sort: 'priority',
    })
    expect(r.tasks.every((t) => t.status === 'in_progress')).toBe(true)
    expect(r.tasks.length).toBe(1)
  })

  it('supports phrase search', () => {
    const r = runAdvancedSearch('"API 설계"', journals, docs, tasks, {
      sources: ['journal'],
    })
    expect(r.journals.some((h) => h.date === '2026-08-03')).toBe(true)
  })

  it('highlights terms', () => {
    expect(highlightText('hello TODO world', 'TODO')).toContain('⟦TODO⟧')
  })
})

describe('saved-searches', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetSavedSearchesForTests()
  })

  it('lists builtins and saves user queries', () => {
    expect(BUILTIN_SEARCH_PRESETS.length).toBeGreaterThan(2)
    expect(listSavedSearches().some((s) => s.id === 'preset-in-progress')).toBe(true)
    const s = saveSearch({
      name: '내 검색',
      query: 'tag:ops',
      filters: { sources: ['journal'] },
    })
    expect(listSavedSearches().some((x) => x.id === s.id)).toBe(true)
    expect(deleteSavedSearch(s.id)).toBe(true)
    expect(deleteSavedSearch('preset-in-progress')).toBe(false)
  })

  it('tracks history', () => {
    pushSearchHistory('alpha')
    pushSearchHistory('beta')
    pushSearchHistory('alpha')
    const h = listSearchHistory()
    expect(h[0]).toBe('alpha')
    expect(h).toContain('beta')
  })
})

describe('search-export', () => {
  it('exports csv and json', () => {
    const hits = runAdvancedSearch('검색', journals, docs, tasks, {}).unified
    const csv = searchHitsToCsv(hits)
    expect(csv).toContain('source')
    const json = JSON.parse(searchHitsToJson(hits)) as { count: number }
    expect(json.count).toBe(hits.length)
  })
})
