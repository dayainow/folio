'use client'

/**
 * P52 — 고급 검색/필터 패널
 * debounce 150ms · 하이라이트 · 프리셋 · 일괄 작업 · CSV/JSON
 */
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  BookmarkPlus,
  BookOpen,
  Download,
  FileText,
  Filter,
  History,
  Kanban,
  Loader2,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { advancedSearchAll } from '@/lib/search'
import type { SearchNavigatePayload } from '@/components/global-search'
import {
  highlightText,
  suggestQueries,
  type AdvancedSearchFilters,
  type AdvancedSearchResult,
  type SearchSort,
  type UnifiedSearchHit,
} from '@/lib/search-engine'
import {
  clearSearchHistory,
  defaultFilters,
  deleteSavedSearch,
  listSavedSearches,
  listSearchHistory,
  pushSearchHistory,
  saveSearch,
  type SavedSearch,
} from '@/lib/saved-searches'
import { bulkApplyTags, downloadSearchHits } from '@/lib/search-export'
import { loadDocsWithFallback } from '@/lib/docs'
import { loadJournalsWithFallback } from '@/lib/journal'
import { loadTasksWithFallback } from '@/lib/board'
import { cn } from '@/lib/utils'
import { useI18n } from '@/components/i18n-provider'
import type { SearchSource } from '@/lib/search'
import type { Task } from '@/lib/board'

const DEBOUNCE_MS = 150

export function AdvancedSearchButton({
  onNavigate,
}: {
  onNavigate: (payload: SearchNavigatePayload) => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  useEffect(() => {
    const openPanel = () => setOpen(true)
    window.addEventListener('folio:open-advanced-search', openPanel)
    return () => window.removeEventListener('folio:open-advanced-search', openPanel)
  }, [])
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 rounded-full border px-2.5 text-[11px] font-medium"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-teal-600" />
        {t('search.advanced')}
      </Button>
      {open ? (
        <AdvancedSearchPanel
          id={panelId}
          onClose={() => setOpen(false)}
          onNavigate={(p) => {
            onNavigate(p)
            setOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const marked = highlightText(text, query)
  const parts = marked.split(/(⟦|⟧)/)
  const nodes: ReactNode[] = []
  let on = false
  for (const p of parts) {
    if (p === '⟦') {
      on = true
      continue
    }
    if (p === '⟧') {
      on = false
      continue
    }
    nodes.push(
      on ? (
        <mark key={nodes.length} className="rounded bg-amber-100 px-0.5 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100">
          {p}
        </mark>
      ) : (
        <span key={nodes.length}>{p}</span>
      ),
    )
  }
  return <>{nodes}</>
}

export function AdvancedSearchPanel({
  id,
  onClose,
  onNavigate,
}: {
  id?: string
  onClose: () => void
  onNavigate: (payload: SearchNavigatePayload) => void
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<AdvancedSearchFilters>(() => defaultFilters())
  const [result, setResult] = useState<AdvancedSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<SavedSearch[]>(() => listSavedSearches())
  const [history, setHistory] = useState<string[]>(() => listSearchHistory())
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [bulkTag, setBulkTag] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [saveName, setSaveName] = useState('')
  const reqId = useRef(0)

  useEffect(() => {
    const hasQuery = query.trim().length > 0
    const hasFilter = Boolean(
      filters.dateFrom ||
        filters.dateTo ||
        filters.tags?.length ||
        filters.status?.length ||
        filters.priority?.length,
    )

    const idNow = ++reqId.current

    if (!hasQuery && !hasFilter) {
      const t = window.setTimeout(() => {
        if (idNow !== reqId.current) return
        setResult(null)
        setLoading(false)
      }, 0)
      return () => window.clearTimeout(t)
    }

    const timer = window.setTimeout(() => {
      setLoading(true)
      void (async () => {
        try {
          const res = await advancedSearchAll(query, filters)
          if (idNow !== reqId.current) return
          setResult(res)
          if (query.trim()) setHistory(pushSearchHistory(query.trim()))
        } finally {
          if (idNow === reqId.current) setLoading(false)
        }
      })()
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [query, filters])

  useEffect(() => {
    void (async () => {
      const [j, d, t] = await Promise.all([
        loadJournalsWithFallback(),
        loadDocsWithFallback(),
        loadTasksWithFallback(),
      ])
      setSuggestions(suggestQueries(j, d, t))
    })()
  }, [])

  const toggleSource = (s: SearchSource) => {
    setFilters((prev) => {
      const cur = new Set<SearchSource>(prev.sources ?? ['journal', 'docs', 'board'])
      if (cur.has(s)) cur.delete(s)
      else cur.add(s)
      if (cur.size === 0) cur.add(s)
      return { ...prev, sources: [...cur] as SearchSource[] }
    })
  }

  const hitKey = (h: UnifiedSearchHit) => `${h.source}:${h.id}`

  const toggleSelect = (h: UnifiedSearchHit) => {
    const k = hitKey(h)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const selectedHits = useMemo(
    () => (result?.unified ?? []).filter((h) => selected.has(hitKey(h))),
    [result, selected],
  )

  const navigateHit = (h: UnifiedSearchHit) => {
    if (h.source === 'journal') {
      onNavigate({
        source: 'journal',
        hit: {
          id: h.id,
          date: h.date ?? h.id,
          title: h.title,
          preview: h.preview,
          tags: h.tags ?? [],
          updatedAt: h.updatedAt,
          score: h.score,
          matched: 'content',
        },
      })
    } else if (h.source === 'docs') {
      onNavigate({
        source: 'docs',
        hit: {
          id: h.id,
          title: h.title,
          preview: h.preview,
          category: h.category ?? '',
          updatedAt: h.updatedAt,
          score: h.score,
          matched: 'content',
        },
      })
    } else {
      onNavigate({
        source: 'board',
        hit: {
          id: h.id,
          title: h.title,
          preview: h.preview,
          status: h.status ?? 'backlog',
          tags: h.tags ?? [],
          updatedAt: h.updatedAt,
          score: h.score,
          matched: 'content',
        },
      })
    }
  }

  const applyPreset = (s: SavedSearch) => {
    setQuery(s.query)
    setFilters({ ...defaultFilters(), ...s.filters })
    setMsg(`프리셋: ${s.name}`)
  }

  const grouped = useMemo(() => {
    const u = result?.unified ?? []
    return {
      journal: u.filter((h) => h.source === 'journal'),
      docs: u.filter((h) => h.source === 'docs'),
      board: u.filter((h) => h.source === 'board'),
    }
  }, [result])

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
      <div
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={t('search.advancedAria')}
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Filter className="h-4 w-4 text-teal-600" />
          <div>
            <h2 className="text-sm font-semibold">{t('search.advancedTitle')}</h2>
            <p className="text-[11px] text-muted-foreground">
              AND/OR/NOT · &quot;구문&quot; · field: · * · /regex/ · P52
            </p>
          </div>
          <Button type="button" size="icon" variant="ghost" className="ml-auto size-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </header>

        {msg ? (
          <p className="border-b border-border bg-muted/40 px-4 py-1.5 text-[11px] text-muted-foreground">
            {msg}
          </p>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[220px_1fr]">
          {/* 사이드: 프리셋 · 히스토리 */}
          <aside className="space-y-3 overflow-y-auto border-b border-border p-3 md:border-b-0 md:border-r">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('search.presets')}
            </p>
            <ul className="space-y-1">
              {saved.map((s) => (
                <li key={s.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-[11px] hover:bg-muted"
                    onClick={() => applyPreset(s)}
                  >
                    {s.name}
                  </button>
                  {!s.builtin ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      onClick={() => {
                        deleteSavedSearch(s.id)
                        setSaved(listSavedSearches())
                      }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>

            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <History className="size-3" /> {t('search.history')}
            </p>
            <ul className="space-y-0.5">
              {history.slice(0, 8).map((h) => (
                <li key={h}>
                  <button
                    type="button"
                    className="w-full truncate rounded px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => setQuery(h)}
                  >
                    {h}
                  </button>
                </li>
              ))}
            </ul>
            {history.length ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-[10px]"
                onClick={() => {
                  clearSearchHistory()
                  setHistory([])
                }}
              >
                {t('search.clearHistory')}
              </Button>
            ) : null}

            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('search.suggestions')}
            </p>
            <div className="flex flex-wrap gap-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full border border-border px-2 py-0.5 text-[10px] hover:bg-muted"
                  onClick={() => setQuery(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </aside>

          {/* 메인 */}
          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="space-y-2 border-b border-border p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  className="h-9 pl-8 text-xs"
                  placeholder='예: tag:배포 AND "TODO" · title:API* · /WIP/i'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
                {loading ? (
                  <Loader2 className="absolute right-2.5 top-2.5 size-3.5 animate-spin text-muted-foreground" />
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(['journal', 'docs', 'board'] as SearchSource[]).map((s) => {
                  const on = (filters.sources ?? []).includes(s)
                  return (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant={on ? 'default' : 'outline'}
                      className="h-7 text-[11px]"
                      onClick={() => toggleSource(s)}
                    >
                      {s === 'journal' ? '일지' : s === 'docs' ? '문서' : '일정'}
                    </Button>
                  )
                })}
                <Input
                  type="date"
                  className="h-7 w-auto text-[11px]"
                  value={filters.dateFrom ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))}
                  aria-label="시작일"
                />
                <Input
                  type="date"
                  className="h-7 w-auto text-[11px]"
                  value={filters.dateTo ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))}
                  aria-label="종료일"
                />
                <Input
                  className="h-7 w-28 text-[11px]"
                  placeholder="태그"
                  value={(filters.tags ?? [])[0] ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      tags: e.target.value.trim() ? [e.target.value.trim()] : undefined,
                    }))
                  }
                />
                <select
                  className="h-7 rounded-md border border-border bg-background px-1 text-[11px]"
                  value={filters.sort ?? 'relevance'}
                  onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as SearchSort }))}
                >
                  <option value="relevance">관련성</option>
                  <option value="date">날짜</option>
                  <option value="priority">우선순위</option>
                </select>
                <select
                  className="h-7 rounded-md border border-border bg-background px-1 text-[11px]"
                  value={(filters.status ?? [])[0] ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      status: e.target.value
                        ? [e.target.value as Task['status']]
                        : undefined,
                    }))
                  }
                >
                  <option value="">상태(전체)</option>
                  <option value="backlog">backlog</option>
                  <option value="in_progress">in_progress</option>
                  <option value="review">review</option>
                  <option value="done">done</option>
                </select>
                <select
                  className="h-7 rounded-md border border-border bg-background px-1 text-[11px]"
                  value={(filters.priority ?? [])[0] ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      priority: e.target.value
                        ? [e.target.value as Task['priority']]
                        : undefined,
                    }))
                  }
                >
                  <option value="">우선순위</option>
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Input
                  className="h-7 w-36 text-[11px]"
                  placeholder="검색 이름 저장"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => {
                    if (!saveName.trim()) {
                      setMsg('저장 이름 필요')
                      return
                    }
                    saveSearch({ name: saveName.trim(), query, filters })
                    setSaved(listSavedSearches())
                    setSaveName('')
                    setMsg('검색 조건 저장됨')
                  }}
                >
                  <BookmarkPlus className="size-3" />
                  저장
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-[11px]"
                  disabled={!result?.unified.length}
                  onClick={() => downloadSearchHits(result!.unified, 'csv')}
                >
                  <Download className="size-3" />
                  CSV
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  disabled={!result?.unified.length}
                  onClick={() => downloadSearchHits(result!.unified, 'json')}
                >
                  JSON
                </Button>
              </div>
            </div>

            {/* 일괄 작업 */}
            {selectedHits.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/30 px-3 py-2">
                <span className="text-[11px]">{selectedHits.length}개 선택</span>
                <Input
                  className="h-7 w-28 text-[11px]"
                  placeholder="태그"
                  value={bulkTag}
                  onChange={(e) => setBulkTag(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => {
                    const r = bulkApplyTags(selectedHits, bulkTag, 'add')
                    setMsg(`태그 추가 · ok ${r.ok} / fail ${r.fail}`)
                    setQuery((q) => q)
                    setFilters((f) => ({ ...f }))
                  }}
                >
                  <Tag className="size-3" />
                  추가
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    const r = bulkApplyTags(selectedHits, bulkTag, 'remove')
                    setMsg(`태그 제거 · ok ${r.ok}`)
                    setFilters((f) => ({ ...f }))
                  }}
                >
                  태그 삭제
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={() => setSelected(new Set())}
                >
                  선택 해제
                </Button>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <p className="mb-2 text-[11px] text-muted-foreground">
                {result ? t('search.resultsCount', { count: result.total }) : t('search.enterQuery')}
                {result?.parsedQuery ? ` · lunr: ${result.parsedQuery}` : ''}
              </p>

              {(
                [
                  ['journal', '일지', BookOpen, grouped.journal],
                  ['docs', '문서', FileText, grouped.docs],
                  ['board', '일정', Kanban, grouped.board],
                ] as const
              ).map(([key, label, Icon, hits]) =>
                hits.length === 0 ? null : (
                  <section key={key} className="mb-4">
                    <h3 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Icon className="size-3" />
                      {label} ({hits.length})
                    </h3>
                    <ul className="space-y-1.5">
                      {hits.map((h) => {
                        const k = hitKey(h)
                        const on = selected.has(k)
                        return (
                          <li key={k}>
                            <div
                              className={cn(
                                'flex gap-2 rounded-xl border border-border p-2.5 transition-colors',
                                on && 'border-teal-300 bg-teal-50/50 dark:bg-teal-950/20',
                              )}
                            >
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={on}
                                onChange={() => toggleSelect(h)}
                                aria-label="선택"
                              />
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() => navigateHit(h)}
                              >
                                <p className="text-xs font-medium">
                                  <Highlighted text={h.title} query={query} />
                                </p>
                                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                                  <Highlighted text={h.preview} query={query} />
                                </p>
                                <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                                  {h.updatedAt?.slice(0, 10)}
                                  {h.status ? ` · ${h.status}` : ''}
                                  {h.priority ? ` · ${h.priority}` : ''}
                                  {h.tags?.length ? ` · ${h.tags.slice(0, 3).join(', ')}` : ''}
                                  {` · score ${Math.round(h.score * 10) / 10}`}
                                </p>
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
