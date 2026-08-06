'use client'

/**
 * P62-1 — 문서 「보기」 (카드 그리드 · 필터 칩 · 폴더 2depth)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownUp, FileText, Filter, Folder, Plus, Search } from 'lucide-react'
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
          d.content.toLowerCase().includes(search.toLowerCase()),
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
                  </button>
                  {(filterCat === cat || filterCat === null) &&
                    children.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        className="ml-4 flex min-h-11 w-[calc(100%-1rem)] items-center gap-2 rounded-lg px-2 text-left text-[11px] text-muted-foreground"
                        onClick={() => openDoc(doc.id)}
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
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => openDoc(doc.id)}
                  className="flex h-[120px] w-full flex-col overflow-hidden rounded-xl border border-slate-100 bg-card p-3.5 text-left shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:border-slate-800 dark:hover:bg-slate-900"
                  aria-label={`문서 ${doc.title}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium">{doc.title}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {new Date(doc.updatedAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {doc.content.replace(/\s+/g, ' ').trim().slice(0, 120) || '(빈 문서)'}
                  </p>
                  <Badge variant="outline" className="mt-1 w-fit text-[9px]">
                    {doc.category}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
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
