/**
 * P52 — 저장된 검색 / 필터 프리셋
 */
'use client'

import type { AdvancedSearchFilters } from '@/lib/search-engine'
import type { SearchSource } from '@/lib/search'

export type SavedSearch = {
  id: string
  name: string
  query: string
  filters: AdvancedSearchFilters
  createdAt: string
  updatedAt: string
  builtin?: boolean
}

const KEY = 'folio_saved_searches'
const HISTORY_KEY = 'folio_search_history'
const EVENT = 'folio-saved-searches'
const MAX_HISTORY = 20

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function weekRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { dateFrom: fmt(monday), dateTo: fmt(sunday) }
}

/** 내장 필터 프리셋 */
export const BUILTIN_SEARCH_PRESETS: SavedSearch[] = [
  {
    id: 'preset-week-journals',
    name: '이번 주 내 일지',
    query: '',
    filters: {
      sources: ['journal'],
      ...weekRange(),
      sort: 'date',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    builtin: true,
  },
  {
    id: 'preset-in-progress',
    name: '진행 중 태스크',
    query: '',
    filters: {
      sources: ['board'],
      status: ['in_progress'],
      sort: 'priority',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    builtin: true,
  },
  {
    id: 'preset-open-docs',
    name: '미완료 문서',
    query: 'TODO OR WIP OR draft',
    filters: {
      sources: ['docs'],
      sort: 'date',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    builtin: true,
  },
  {
    id: 'preset-high-priority',
    name: '높은 우선순위',
    query: '',
    filters: {
      sources: ['board'],
      priority: ['high'],
      status: ['backlog', 'in_progress', 'review'],
      sort: 'date',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    builtin: true,
  },
]

function readUserSaved(): SavedSearch[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedSearch[]
    return Array.isArray(parsed) ? parsed.filter((s) => s && s.id && s.name) : []
  } catch {
    return []
  }
}

function writeUserSaved(list: SavedSearch[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch {
    /* ignore */
  }
}

export function listSavedSearches(): SavedSearch[] {
  const presets = BUILTIN_SEARCH_PRESETS.map((p) => {
    if (p.id === 'preset-week-journals') {
      return { ...p, filters: { ...p.filters, ...weekRange() } }
    }
    return p
  })
  return [...presets, ...readUserSaved()].sort((a, b) =>
    a.builtin === b.builtin ? a.name.localeCompare(b.name) : a.builtin ? -1 : 1,
  )
}

export function saveSearch(input: {
  name: string
  query: string
  filters: AdvancedSearchFilters
  id?: string
}): SavedSearch {
  const now = new Date().toISOString()
  const list = readUserSaved()
  if (input.id) {
    const idx = list.findIndex((s) => s.id === input.id)
    if (idx >= 0) {
      const next = {
        ...list[idx]!,
        name: input.name,
        query: input.query,
        filters: input.filters,
        updatedAt: now,
      }
      list[idx] = next
      writeUserSaved(list)
      return next
    }
  }
  const created: SavedSearch = {
    id: input.id ?? uid(),
    name: input.name,
    query: input.query,
    filters: input.filters,
    createdAt: now,
    updatedAt: now,
  }
  writeUserSaved([created, ...list])
  return created
}

export function deleteSavedSearch(id: string): boolean {
  if (id.startsWith('preset-')) return false
  const next = readUserSaved().filter((s) => s.id !== id)
  writeUserSaved(next)
  return true
}

export function getSavedSearch(id: string): SavedSearch | undefined {
  return listSavedSearches().find((s) => s.id === id)
}

export function pushSearchHistory(query: string): string[] {
  const q = query.trim()
  if (!q || typeof window === 'undefined') return listSearchHistory()
  try {
    const prev = listSearchHistory().filter((x) => x !== q)
    const next = [q, ...prev].slice(0, MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    return next
  } catch {
    return listSearchHistory()
  }
}

export function listSearchHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function clearSearchHistory(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(HISTORY_KEY)
}

export function subscribeSavedSearches(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const on = () => listener()
  window.addEventListener(EVENT, on)
  return () => window.removeEventListener(EVENT, on)
}

export function defaultFilters(): AdvancedSearchFilters {
  return {
    sources: ['journal', 'docs', 'board'] as SearchSource[],
    sort: 'relevance',
  }
}

export function __resetSavedSearchesForTests(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
  localStorage.removeItem(HISTORY_KEY)
}
