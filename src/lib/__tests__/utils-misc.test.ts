import { describe, expect, it, vi } from 'vitest'
import { debounce } from '@/lib/debounce'
import { loadFavorites, saveFavorites, toggleFavorite } from '@/lib/favorites'
import { buildFolioDeepLink, parseFolioDeepLink } from '@/lib/folio-links'
import { buildTitleIndex, extractWikiLinks, normalizeDocTitle } from '@/lib/link-parser'

describe('debounce', () => {
  it('delays invocation and flush runs immediately', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d()
    expect(fn).not.toHaveBeenCalled()
    d.flush()
    expect(fn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('cancel prevents call', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 50)
    d()
    d.cancel()
    vi.advanceTimersByTime(100)
    expect(fn).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('favorites', () => {
  it('toggles ids', () => {
    localStorage.clear()
    expect(toggleFavorite('a')).toEqual(['a'])
    expect(toggleFavorite('a')).toEqual([])
    saveFavorites(['x', 'y'])
    expect(loadFavorites()).toEqual(['x', 'y'])
  })
})

describe('folio deep links', () => {
  it('builds and parses journal link', () => {
    const url = buildFolioDeepLink({ tab: 'journal', date: '2026-08-03' }, 'https://folio.test')
    expect(url).toContain('tab=journal')
    expect(url).toContain('date=2026-08-03')
    const parsed = parseFolioDeepLink('?tab=journal&date=2026-08-03')
    expect(parsed.tab).toBe('journal')
    expect(parsed.date).toBe('2026-08-03')
  })

  it('parses docs and board', () => {
    expect(parseFolioDeepLink('?tab=docs&docId=abc').docId).toBe('abc')
    expect(parseFolioDeepLink('?tab=board&taskId=t1').taskId).toBe('t1')
  })
})

describe('wiki links', () => {
  it('extracts wiki links', () => {
    const links = extractWikiLinks('See [[API]] and [[Guide|手册]]')
    expect(links.length).toBe(2)
    expect(links[0]?.target).toBe('API')
    expect(links[1]?.alias).toBe('手册')
  })

  it('buildTitleIndex maps normalized titles', () => {
    const docs = [
      { id: '1', title: 'API', category: 'Eng', content: '' },
      { id: '2', title: 'Guide', category: 'Eng', content: '[[API]]' },
    ]
    const index = buildTitleIndex(docs)
    expect(index.get(normalizeDocTitle('API'))).toBe('1')
  })
})
