'use client'

/**
 * P62-1 — 문서 「보기」 (카드 그리드 · 필터 칩 · 폴더 2depth)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownUp,
  BookOpen,
  Clock3,
  FileText,
  Filter,
  Folder,
  LayoutGrid,
  List,
  Maximize2,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FilterDrawer } from '@/components/filter-drawer'
import { cn } from '@/lib/utils'
import { loadCategories, loadDocsWithFallback, type DocEntry } from '@/lib/docs'
import { isBookmarked } from '@/lib/bookmarks'
import { isShareExpired, listShareLinks } from '@/lib/share-links'

export type DocsBrowsePanelProps = {
  focusDocId?: string | null
  onFocusHandled?: () => void
  onOpenWrite?: (docId: string) => void
  onCreateNew?: () => void
}

type Scope = 'all' | 'mine' | 'shared' | 'bookmarked'
type Sort = 'newest' | 'oldest' | 'title'
type DocsView = 'gallery' | 'list'

const DOCS_VIEW_KEY = 'folio_docs_view_v1'

function loadDocsView(): DocsView {
  return localStorage.getItem(DOCS_VIEW_KEY) === 'list' ? 'list' : 'gallery'
}

function formatUpdated(value: string): string {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const day = 86_400_000
  if (diff < day && date.toDateString() === new Date().toDateString()) {
    return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
  }
  if (diff < day * 7) return `${Math.max(1, Math.floor(diff / day))}일 전`
  return date.toLocaleDateString('ko-KR')
}

function wordCount(content: string): number {
  return content.trim() ? content.trim().split(/\s+/).length : 0
}

function docPreview(content: string, length = 180): string {
  return content
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/[#*_>`~\[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, length) || '(빈 문서)'
}

export function DocsBrowsePanel({
  focusDocId,
  onFocusHandled,
  onOpenWrite,
  onCreateNew,
}: DocsBrowsePanelProps) {
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [ready, setReady] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [scope, setScope] = useState<Scope>('all')
  const [sort, setSort] = useState<Sort>('newest')
  const [drawer, setDrawer] = useState<'sort' | 'filter' | null>(null)
  const [view, setView] = useState<DocsView>('gallery')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    queueMicrotask(() => setView(loadDocsView()))
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadDocsWithFallback().then((next) => {
      if (cancelled) return
      setDocs(next)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready || !focusDocId) return
    onOpenWrite?.(focusDocId)
    onFocusHandled?.()
  }, [ready, focusDocId, onOpenWrite, onFocusHandled])

  const categories = useMemo(() => loadCategories(docs), [docs])
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const doc of docs) counts.set(doc.category, (counts.get(doc.category) ?? 0) + 1)
    return counts
  }, [docs])

  const sharedTitles = useMemo(() => {
    const titles = new Set<string>()
    for (const link of listShareLinks()) {
      if (link.type !== 'doc' || isShareExpired(link)) continue
      titles.add(link.title)
    }
    return titles
  }, [])

  const filtered = useMemo(() => {
    return docs
      .filter(
        (d) =>
          !search ||
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.content.toLowerCase().includes(search.toLowerCase()) ||
          `${d.source ?? ''} ${d.noteType ?? ''} ${(d.tags ?? []).join(' ')}`.toLowerCase().includes(search.toLowerCase()),
      )
      .filter((d) => !filterCat || d.category === filterCat)
      .filter((d) => {
        if (scope === 'bookmarked') return isBookmarked('doc', d.id)
        if (scope === 'shared') return sharedTitles.has(d.title)
        if (scope === 'mine') return !sharedTitles.has(d.title)
        return true
      })
      .sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title, 'ko')
        if (sort === 'oldest') return a.updatedAt.localeCompare(b.updatedAt)
        return b.updatedAt.localeCompare(a.updatedAt)
      })
  }, [docs, search, filterCat, scope, sort, sharedTitles])

  const openDoc = useCallback(
    (id: string) => {
      onOpenWrite?.(id)
    },
    [onOpenWrite],
  )

  const selectedDoc = useMemo(
    () => docs.find((doc) => doc.id === selectedId) ?? null,
    [docs, selectedId],
  )

  const selectDoc = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const changeView = (next: DocsView) => {
    setView(next)
    localStorage.setItem(DOCS_VIEW_KEY, next)
  }

  if (!ready) {
    return <p className="py-8 text-center text-xs text-muted-foreground">문서 불러오는 중…</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Card className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm dark:border-slate-800">
        <div className="border-b border-slate-50 p-3 dark:border-slate-800">
          <Button type="button" className="w-full gap-2" onClick={() => onCreateNew?.()}>
            <Plus className="h-4 w-4" /> 새 문서
          </Button>
        </div>
        <ScrollArea className="h-[min(60vh,28rem)]">
          <div className="space-y-1 p-2" role="tree" aria-label="문서 폴더">
            <button
              type="button"
              className={cn(
                'flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-xs',
                filterCat === null && 'bg-slate-100 dark:bg-slate-800',
              )}
              onClick={() => setFilterCat(null)}
            >
              <Folder className="h-3.5 w-3.5 text-muted-foreground" />
              모든 폴더
            </button>
            {categories.slice(0, 12).map((cat) => {
              const children = filtered.filter((d) => d.category === cat).slice(0, 8)
              return (
                <div key={cat} className="space-y-0.5">
                  <button
                    type="button"
                    className={cn(
                      'flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-medium',
                      filterCat === cat && 'bg-slate-100 dark:bg-slate-800',
                    )}
                    onClick={() => setFilterCat(filterCat === cat ? null : cat)}
                  >
                    <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{cat}</span>
                    <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                      {categoryCounts.get(cat) ?? 0}
                    </span>
                  </button>
                  {(filterCat === cat || filterCat === null) &&
                    children.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        className={cn(
                          'ml-4 flex min-h-10 w-[calc(100%-1rem)] items-center gap-2 rounded-lg px-2 text-left text-[11px] text-muted-foreground transition-colors hover:bg-slate-50 dark:hover:bg-slate-900',
                          selectedId === doc.id && 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100',
                        )}
                        onClick={() => selectDoc(doc.id)}
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate">{doc.title}</span>
                      </button>
                    ))}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="문서 검색…"
              className="h-11 pl-8 text-xs"
              aria-label="문서 검색"
            />
          </div>
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900" role="group" aria-label="문서 보기 방식">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('h-9 gap-1.5 rounded-md px-2.5 text-xs', view === 'list' && 'bg-white shadow-sm hover:bg-white dark:bg-slate-800 dark:hover:bg-slate-800')}
              aria-pressed={view === 'list'}
              onClick={() => changeView('list')}
            >
              <List className="h-3.5 w-3.5" /> 리스트
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('h-9 gap-1.5 rounded-md px-2.5 text-xs', view === 'gallery' && 'bg-white shadow-sm hover:bg-white dark:bg-slate-800 dark:hover:bg-slate-800')}
              aria-pressed={view === 'gallery'}
              onClick={() => changeView('gallery')}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> 갤러리
            </Button>
          </div>
          <Button type="button" variant="outline" aria-label="정렬" onClick={() => setDrawer('sort')}>
            <ArrowDownUp className="h-4 w-4" />
            정렬
          </Button>
          <Button type="button" variant="outline" aria-label="필터" onClick={() => setDrawer('filter')}>
            <Filter className="h-4 w-4" />
            필터
          </Button>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="문서 범위">
          {(
            [
              ['all', '전체'],
              ['mine', '내 문서'],
              ['shared', '공유'],
              ['bookmarked', '북마크'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setScope(k)}
              className={cn(
                'min-h-11 rounded-lg px-3 text-xs shadow-sm',
                scope === k
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
              )}
              aria-pressed={scope === k}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-16 text-center dark:border-slate-700">
            <p className="text-sm font-medium text-slate-600">문서가 없습니다</p>
            <Button type="button" className="gap-2" onClick={() => onCreateNew?.()}>
              <Plus className="h-4 w-4" />첫 문서 작성하기
            </Button>
          </div>
        ) : (
          <div className={cn('grid gap-3', selectedDoc && 'xl:grid-cols-[minmax(0,1fr)_20rem]')}>
            <ul className={cn(
              view === 'gallery'
                ? 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-3'
                : 'divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 bg-card dark:divide-slate-800 dark:border-slate-800',
            )}>
              {filtered.map((doc) => {
                const selected = selectedId === doc.id
                return (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => selectDoc(doc.id)}
                      onDoubleClick={() => openDoc(doc.id)}
                      className={cn(
                        'w-full text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                        view === 'gallery'
                          ? 'flex min-h-[11rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900'
                          : 'grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900',
                        selected && 'border-emerald-200 bg-emerald-50/80 shadow-[0_10px_24px_-16px_rgba(5,150,105,0.5)] dark:border-emerald-800 dark:bg-emerald-950/25',
                      )}
                      aria-pressed={selected}
                      aria-label={`문서 ${doc.title}, 선택 후 두 번 클릭하여 열기`}
                    >
                      {view === 'gallery' ? (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                              <FileText className="h-4 w-4" />
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock3 className="h-3 w-3" /> {formatUpdated(doc.updatedAt)}
                            </span>
                          </div>
                          <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-slate-950 dark:text-slate-50">{doc.title}</h3>
                          <p className="mt-2 line-clamp-3 flex-1 text-xs leading-5 text-muted-foreground">{docPreview(doc.content)}</p>
                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                            <span className="flex min-w-0 items-center gap-1">
                              <Badge variant="secondary" className="max-w-32 truncate rounded-full text-[9px]">{doc.category}</Badge>
                              {doc.source ? <Badge variant="outline" className="rounded-full text-[9px]">{doc.source}</Badge> : null}
                            </span>
                            <span className="text-[9px] text-muted-foreground">{wordCount(doc.content)}단어</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{doc.title}</p>
                              <p className="truncate text-[10px] text-muted-foreground">{doc.category}{doc.source ? ` · ${doc.source}` : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span>{wordCount(doc.content)}단어</span>
                            <span>{formatUpdated(doc.updatedAt)}</span>
                          </div>
                        </>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>

            {selectedDoc && (
              <aside className="sticky top-3 h-fit overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900" aria-label="문서 미리보기">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <BookOpen className="h-4 w-4" /> 미리보기
                  </span>
                  <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="미리보기 닫기" onClick={() => setSelectedId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="rounded-full text-[10px]">{selectedDoc.category}</Badge>
                    {selectedDoc.source ? <Badge variant="outline" className="rounded-full text-[10px]">{selectedDoc.source}</Badge> : null}
                    {selectedDoc.noteType ? <Badge variant="outline" className="rounded-full text-[10px]">{selectedDoc.noteType}</Badge> : null}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">{selectedDoc.title}</h2>
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{formatUpdated(selectedDoc.updatedAt)} 수정</span>
                    <span>{wordCount(selectedDoc.content)}단어</span>
                  </div>
                  <p className="mt-5 line-clamp-[12] whitespace-pre-wrap text-[13px] leading-6 text-slate-600 dark:text-slate-300">
                    {docPreview(selectedDoc.content, 900)}
                  </p>
                  <Button type="button" className="mt-5 w-full gap-2" onClick={() => openDoc(selectedDoc.id)}>
                    <Maximize2 className="h-4 w-4" /> 전체 화면에서 편집
                  </Button>
                </div>
              </aside>
            )}
          </div>
        )}
      </div>

      <FilterDrawer open={drawer === 'sort'} onClose={() => setDrawer(null)} title="정렬">
        <div className="flex flex-col gap-2">
          {(
            [
              ['newest', '최신 수정순'],
              ['oldest', '오래된순'],
              ['title', '제목순'],
            ] as const
          ).map(([k, label]) => (
            <Button
              key={k}
              type="button"
              variant={sort === k ? 'default' : 'outline'}
              className="w-full justify-start"
              onClick={() => {
                setSort(k)
                setDrawer(null)
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </FilterDrawer>

      <FilterDrawer open={drawer === 'filter'} onClose={() => setDrawer(null)} title="폴더 필터">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={filterCat === null ? 'default' : 'outline'} onClick={() => setFilterCat(null)}>
            전체
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              type="button"
              size="sm"
              variant={filterCat === cat ? 'default' : 'outline'}
              onClick={() => setFilterCat(filterCat === cat ? null : cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </FilterDrawer>
    </div>
  )
}
