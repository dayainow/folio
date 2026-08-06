'use client'

/**
 * P62 — 일지 「보기」 단순화 (날짜 · 카드 · 필터/정렬 드로어)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownUp, Filter, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { JournalDatePicker } from '@/components/journal-calendar'
import { JournalStatsPanel } from '@/components/journal-stats'
import { FilterDrawer } from '@/components/filter-drawer'
import { cn } from '@/lib/utils'
import {
  getAllTags,
  loadJournals,
  loadJournalsWithFallback,
  type JournalEntry,
} from '@/lib/journal'
import { findFolderBySlug } from '@/lib/journal-tree'
import { todayStr } from '@/lib/calendar-engine'

export type JournalBrowsePanelProps = {
  focusDate?: string | null
  focusFolder?: string | null
  onOpenWrite?: (date: string) => void
  onFocusHandled?: () => void
}

type SortOrder = 'newest' | 'oldest'
type DrawerMode = 'filter' | 'sort' | null
type ExtraView = 'cards' | 'stats'

function firstLines(content: string, n = 2): string {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return '(빈 일지)'
  return lines.slice(0, n).join('\n')
}

function titleFromContent(content: string, date: string): string {
  const first = content
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .find(Boolean)
  return first?.slice(0, 48) || date
}

export function JournalBrowsePanel({
  focusDate,
  focusFolder,
  onOpenWrite,
  onFocusHandled,
}: JournalBrowsePanelProps) {
  const [journals, setJournals] = useState<Record<string, JournalEntry>>({})
  const [ready, setReady] = useState(false)
  const [date, setDate] = useState(() => todayStr())
  const [sort, setSort] = useState<SortOrder>('newest')
  const [tag, setTag] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [drawer, setDrawer] = useState<DrawerMode>(null)
  const [extra, setExtra] = useState<ExtraView>('cards')

  const reload = useCallback(() => {
    setJournals(loadJournals())
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadJournalsWithFallback().then((j) => {
      if (cancelled) return
      setJournals(j)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready || !focusDate) return
    queueMicrotask(() => {
      setDate(focusDate)
      onFocusHandled?.()
    })
  }, [focusDate, ready, onFocusHandled])

  useEffect(() => {
    if (!ready || !focusFolder) return
    queueMicrotask(() => {
      findFolderBySlug(focusFolder)
      /* 폴더 포커스는 필터 드로어에서 확인 — 카드 목록은 태그/기간 중심 */
    })
  }, [focusFolder, ready])

  const tags = useMemo(() => getAllTags(journals), [journals])

  const rows = useMemo(() => {
    const list = Object.entries(journals).filter(([, e]) => e.content?.trim() || (e.tags?.length ?? 0) > 0)
    return list
      .filter(([d, e]) => {
        if (tag && !(e.tags ?? []).includes(tag)) return false
        if (from && d < from) return false
        if (to && d > to) return false
        return true
      })
      .sort((a, b) => (sort === 'newest' ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])))
  }, [journals, tag, from, to, sort])

  const selected = journals[date]
  const openWrite = (d: string) => {
    setDate(d)
    onOpenWrite?.(d)
  }

  if (!ready) {
    return <p className="py-8 text-center text-xs text-muted-foreground">일지 불러오는 중…</p>
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* 상단: 날짜 · 필터 · 정렬 (최대 3) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <JournalDatePicker
          journals={journals}
          value={date}
          onChange={(d) => openWrite(d)}
          onJournalsChange={reload}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            aria-label="필터"
            onClick={() => setDrawer('filter')}
          >
            <Filter className="h-4 w-4" aria-hidden />
            필터
            {(tag || from || to || extra === 'stats') && (
              <span className="ml-1 size-1.5 rounded-full bg-slate-900 dark:bg-slate-100" aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-label="정렬"
            onClick={() => setDrawer('sort')}
          >
            <ArrowDownUp className="h-4 w-4" aria-hidden />
            {sort === 'newest' ? '최신순' : '오래된순'}
          </Button>
        </div>
      </div>

      {extra === 'stats' ? (
        <div className="space-y-3">
          <Button type="button" variant="secondary" onClick={() => setExtra('cards')}>
            카드 목록으로
          </Button>
          <JournalStatsPanel journals={journals} />
        </div>
      ) : (
        <>
          {/* 선택 날짜 하이라이트 카드 */}
          {selected?.content?.trim() || (selected?.tags?.length ?? 0) > 0 ? (
            <button
              type="button"
              onClick={() => openWrite(date)}
              className="w-full rounded-xl border border-slate-200 bg-card p-4 text-left shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:border-slate-700 dark:hover:bg-slate-900"
              style={{ maxHeight: 120 }}
              aria-label={`${date} 일지 열기`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {titleFromContent(selected.content, date)}
                </p>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{date}</span>
              </div>
              <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {firstLines(selected.content)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {(selected.tags ?? []).slice(0, 4).map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">
                    #{t}
                  </Badge>
                ))}
              </div>
            </button>
          ) : null}

          {/* 목록 카드 */}
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-16 text-center dark:border-slate-700">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">일지가 없습니다</p>
              <Button type="button" onClick={() => openWrite(todayStr())} className="gap-2">
                <PenLine className="h-4 w-4" aria-hidden />
                첫 일지 작성하기
              </Button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {rows.map(([d, entry]) => (
                <li key={d}>
                  <button
                    type="button"
                    onClick={() => openWrite(d)}
                    className={cn(
                      'flex h-[120px] w-full flex-col overflow-hidden rounded-xl border border-slate-100 bg-card p-3.5 text-left shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:border-slate-800 dark:hover:bg-slate-900',
                      d === date && 'ring-2 ring-slate-900 dark:ring-slate-100',
                    )}
                    aria-label={`${d} 일지`}
                    aria-current={d === date ? 'true' : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {titleFromContent(entry.content, d)}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{d}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 flex-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {firstLines(entry.content)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(entry.tags ?? []).slice(0, 3).map((t) => (
                        <Badge key={t} variant="outline" className="text-[9px]">
                          #{t}
                        </Badge>
                      ))}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <FilterDrawer
        open={drawer === 'filter'}
        onClose={() => setDrawer(null)}
        title="필터"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setTag(null)
                setFrom('')
                setTo('')
                setExtra('cards')
              }}
            >
              초기화
            </Button>
            <Button type="button" className="flex-1" onClick={() => setDrawer(null)}>
              적용
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">태그</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={tag === null ? 'default' : 'outline'}
                onClick={() => setTag(null)}
              >
                전체
              </Button>
              {tags.slice(0, 24).map((t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={tag === t ? 'default' : 'outline'}
                  onClick={() => setTag(tag === t ? null : t)}
                >
                  #{t}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">기간</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-muted-foreground">
                시작
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
              </label>
              <label className="text-[11px] text-muted-foreground">
                종료
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
              </label>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">더보기</p>
            <Button
              type="button"
              variant={extra === 'stats' ? 'default' : 'secondary'}
              className="w-full"
              onClick={() => {
                setExtra('stats')
                setDrawer(null)
              }}
            >
              통계 보기
            </Button>
          </div>
        </div>
      </FilterDrawer>

      <FilterDrawer open={drawer === 'sort'} onClose={() => setDrawer(null)} title="정렬">
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant={sort === 'newest' ? 'default' : 'outline'}
            className="w-full justify-start"
            onClick={() => {
              setSort('newest')
              setDrawer(null)
            }}
          >
            최신순
          </Button>
          <Button
            type="button"
            variant={sort === 'oldest' ? 'default' : 'outline'}
            className="w-full justify-start"
            onClick={() => {
              setSort('oldest')
              setDrawer(null)
            }}
          >
            오래된순
          </Button>
        </div>
      </FilterDrawer>
    </div>
  )
}
