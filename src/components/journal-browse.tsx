'use client'

/**
 * P62 — 일지 「보기」 단순화 (날짜 · 카드 · 필터/정렬 드로어)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDownUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  GripVertical,
  LayoutGrid,
  List,
  Pencil,
  PenLine,
  Settings2,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { JournalDatePicker } from '@/components/journal-calendar'
import { JournalStatsPanel } from '@/components/journal-stats'
import { FilterDrawer } from '@/components/filter-drawer'
import { cn } from '@/lib/utils'
import {
  getAllTags,
  deleteJournals,
  loadJournals,
  loadJournalsWithFallback,
  type JournalEntry,
} from '@/lib/journal'
import { findFolderBySlug } from '@/lib/journal-tree'
import { todayStr } from '@/lib/calendar-engine'

export type JournalBrowsePanelProps = {
  focusDate?: string | null
  focusFolder?: string | null
  onOpenWrite?: (date: string, entryKey?: string) => void
  onFocusHandled?: () => void
}

type SortOrder = 'newest' | 'oldest' | 'manual'
type DrawerMode = 'filter' | 'sort' | null
type ExtraView = 'cards' | 'stats'
type ListView = 'cards' | 'compact'
type PeriodView = 'day' | 'week' | 'month'

const ORDER_KEY = 'folio_journal_manual_order_v1'
const VIEW_KEY = 'folio_journal_list_view_v1'
const PERIOD_KEY = 'folio_journal_period_view_v1'
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const

function loadManualOrder(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function saveManualOrder(order: string[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(order))
}

function loadListView(): ListView {
  return localStorage.getItem(VIEW_KEY) === 'compact' ? 'compact' : 'cards'
}

function saveListView(view: ListView) {
  localStorage.setItem(VIEW_KEY, view)
}

function loadPeriodView(): PeriodView {
  const stored = localStorage.getItem(PERIOD_KEY)
  return stored === 'week' || stored === 'month' ? stored : 'day'
}

function localDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function dateString(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function weekBounds(value: string): { start: string; end: string } {
  const start = localDate(value)
  const weekday = start.getDay()
  start.setDate(start.getDate() + (weekday === 0 ? -6 : 1 - weekday))
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: dateString(start), end: dateString(end) }
}

function datesFrom(start: string, count: number): string[] {
  const first = localDate(start)
  return Array.from({ length: count }, (_, index) => {
    const value = new Date(first)
    value.setDate(first.getDate() + index)
    return dateString(value)
  })
}

function monthGridDates(anchor: string): string[] {
  const first = localDate(`${anchor.slice(0, 7)}-01`)
  const weekday = first.getDay()
  first.setDate(first.getDate() + (weekday === 0 ? -6 : 1 - weekday))
  return datesFrom(dateString(first), 42)
}

function periodLabel(period: PeriodView, anchor: string): string {
  if (period === 'day') {
    if (anchor === todayStr()) return '오늘'
    const value = localDate(anchor)
    return `${value.getMonth() + 1}월 ${value.getDate()}일`
  }
  if (period === 'month') {
    const value = localDate(anchor)
    return `${value.getFullYear()}년 ${value.getMonth() + 1}월`
  }
  const { start, end } = weekBounds(anchor)
  const format = (value: string) => {
    const parsed = localDate(value)
    return `${parsed.getMonth() + 1}.${parsed.getDate()}`
  }
  return `${format(start)} – ${format(end)}`
}

function titleFromContent(content: string, date: string): string {
  const first = content
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .find(Boolean)
  return first?.slice(0, 48) || date
}

function bodyFromContent(content: string): string {
  const lines = content.split(/\r?\n/)
  const firstContentLine = lines.findIndex((line) => line.trim())
  if (firstContentLine < 0) return '내용이 없는 메모입니다.'
  const body = lines.slice(firstContentLine + 1).join('\n').trim()
  return body || lines[firstContentLine]!.replace(/^#+\s*/, '').trim()
}

function cardDateLabel(date: string): string {
  if (date === todayStr()) return '오늘'
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(parsed)
}

function savedTime(entry: JournalEntry): string {
  const parsed = new Date(entry.updatedAt)
  if (Number.isNaN(parsed.getTime())) return '저장됨'
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed)
}

function cardAccent(entryKey: string): string {
  const value = Array.from(entryKey).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4
  return [
    'from-emerald-600 via-teal-500 to-cyan-400',
    'from-sky-600 via-blue-500 to-indigo-400',
    'from-violet-600 via-purple-500 to-fuchsia-400',
    'from-amber-500 via-orange-500 to-rose-400',
  ][value]!
}

function calendarChipTone(entryKey: string, selected: boolean): string {
  if (selected) return 'border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100'
  const value = Array.from(entryKey).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4
  return [
    'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
    'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200',
    'border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200',
    'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  ][value]!
}

function CalendarJournalChip({
  entryKey,
  entry,
  selected,
  showTime = false,
  onActivate,
}: {
  entryKey: string
  entry: JournalEntry
  selected: boolean
  showTime?: boolean
  onActivate: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
        calendarChipTone(entryKey, selected),
      )}
      title={selected ? '한 번 더 눌러 상세 열기' : titleFromContent(entry.content, entry.date)}
      aria-pressed={selected}
      onClick={onActivate}
    >
      {showTime && <span className="shrink-0 text-[9px] tabular-nums opacity-65">{savedTime(entry)}</span>}
      <span className="truncate">{titleFromContent(entry.content, entry.date)}</span>
    </button>
  )
}

function SortableJournalItem({
  entryKey,
  entry,
  selected,
  listView,
  manage,
  onActivate,
  onEdit,
  onDelete,
}: {
  entryKey: string
  entry: JournalEntry
  selected: boolean
  listView: ListView
  manage: boolean
  onActivate: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entryKey,
    disabled: !manage,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative flex items-stretch gap-1.5',
        isDragging && 'z-20 opacity-60',
      )}
    >
      {manage && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="my-auto size-9 shrink-0 cursor-grab touch-none active:cursor-grabbing"
          title="끌어서 순서 변경"
          aria-label={`${titleFromContent(entry.content, entry.date)} 순서 변경`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
      )}
      <button
        type="button"
        onClick={onActivate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onActivate()
          }
        }}
        className={cn(
          'relative flex w-full flex-col overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100',
          listView === 'cards'
            ? 'min-h-[210px] rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_25px_-12px_rgba(15,23,42,0.32)] transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_18px_36px_-16px_rgba(15,23,42,0.38)] dark:border-slate-700/80 dark:bg-slate-900 dark:hover:border-slate-600'
            : 'min-h-11 justify-center rounded-lg border border-slate-100 bg-card px-3 py-2 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900',
          selected && (
            listView === 'cards'
              ? 'border-emerald-200/80 bg-emerald-50/70 shadow-[0_14px_32px_-16px_rgba(5,150,105,0.35)] dark:border-emerald-800/70 dark:bg-emerald-950/25'
              : 'border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-800/60 dark:bg-emerald-950/25'
          ),
        )}
        aria-label={`${entry.date} 일지, 한 번 선택 후 다시 눌러 열기`}
        title={selected ? '한 번 더 눌러 상세 열기' : '선택'}
        aria-current={selected ? 'true' : undefined}
      >
        {listView === 'cards' ? (
          <>
            <div
              className={cn(
                'relative h-3 w-full overflow-hidden border-b border-white/20 bg-gradient-to-r',
                cardAccent(entryKey),
              )}
              aria-hidden
            >
              <span className="absolute -left-5 -top-6 h-12 w-32 rotate-12 rounded-full bg-white/30 blur-lg" />
              <span className="absolute left-1/3 top-0 h-full w-20 -skew-x-[28deg] bg-white/15" />
              <span className="absolute right-5 top-1/2 flex -translate-y-1/2 gap-1">
                <span className="size-1 rounded-full bg-white/85 shadow-sm" />
                <span className="size-1 rounded-full bg-white/55" />
                <span className="size-1 rounded-full bg-white/30" />
              </span>
            </div>
            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                  {cardDateLabel(entry.date)}
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">{entry.date}</span>
              </div>

              <h3 className="mt-4 line-clamp-1 text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                {titleFromContent(entry.content, entry.date)}
              </h3>
              <p className="mt-2 line-clamp-3 flex-1 whitespace-pre-wrap text-[13px] leading-5 text-slate-500 dark:text-slate-400">
                {bodyFromContent(entry.content)}
              </p>

              <div className="mt-4 flex min-h-6 items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                  {(entry.tags ?? []).slice(0, 2).map((t) => (
                    <Badge key={t} variant="secondary" className="max-w-24 truncate rounded-full px-2 text-[9px] font-normal">
                      #{t}
                    </Badge>
                  ))}
                  {(entry.tags?.length ?? 0) > 2 && (
                    <span className="text-[10px] text-muted-foreground">+{entry.tags.length - 2}</span>
                  )}
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock3 className="h-3 w-3" aria-hidden />
                  {savedTime(entry)}
                </span>
              </div>
            </div>
          </>
        ) : (
          <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {titleFromContent(entry.content, entry.date)}
          </span>
        )}
      </button>
      {manage && (
        <div className="flex shrink-0 flex-col justify-center gap-1" aria-label="메모 관리">
          <Button type="button" variant="outline" size="icon" className="size-9" title="편집" aria-label="편집" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="size-9 text-red-600 hover:text-red-700" title="삭제" aria-label="삭제" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </li>
  )
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
  const [listView, setListView] = useState<ListView>('cards')
  const [manage, setManage] = useState(false)
  const [manualOrder, setManualOrder] = useState<string[]>([])
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null)
  const [period, setPeriod] = useState<PeriodView>('day')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const reload = useCallback(() => {
    setJournals(loadJournals())
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      setManualOrder(loadManualOrder())
      setListView(loadListView())
      setPeriod(loadPeriodView())
    })
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

  const calendarJournals = useMemo(() => {
    const byDate: Record<string, JournalEntry> = {}
    for (const entry of Object.values(journals)) {
      const previous = byDate[entry.date]
      if (!previous || entry.updatedAt > previous.updatedAt) byDate[entry.date] = entry
    }
    return byDate
  }, [journals])

  const rows = useMemo(() => {
    const list = Object.entries(journals).filter(([, e]) => e.content?.trim() || (e.tags?.length ?? 0) > 0)
    const filtered = list
      .filter(([, e]) => {
        if (period === 'day' && e.date !== date) return false
        if (period === 'week') {
          const bounds = weekBounds(date)
          if (e.date < bounds.start || e.date > bounds.end) return false
        }
        if (period === 'month' && e.date.slice(0, 7) !== date.slice(0, 7)) return false
        if (tag && !(e.tags ?? []).includes(tag)) return false
        if (from && e.date < from) return false
        if (to && e.date > to) return false
        return true
      })
    if (sort === 'manual' && manualOrder.length > 0) {
      const positions = new Map(manualOrder.map((key, index) => [key, index]))
      return filtered.sort((a, b) =>
        (positions.get(a[0]) ?? Number.MAX_SAFE_INTEGER) -
        (positions.get(b[0]) ?? Number.MAX_SAFE_INTEGER),
      )
    }
    return filtered.sort((a, b) => {
        const left = `${a[1].date}:${a[1].updatedAt}`
        const right = `${b[1].date}:${b[1].updatedAt}`
        return sort === 'newest' ? right.localeCompare(left) : left.localeCompare(right)
      })
  }, [journals, tag, from, to, sort, manualOrder, period, date])

  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, Array<[string, JournalEntry]>>()
    for (const row of rows) {
      const group = grouped.get(row[1].date) ?? []
      group.push(row)
      grouped.set(row[1].date, group)
    }
    return grouped
  }, [rows])

  const visibleCalendarDates = useMemo(() => {
    if (period === 'week') return datesFrom(weekBounds(date).start, 7)
    if (period === 'month') return monthGridDates(date)
    return []
  }, [period, date])

  const enterManageMode = () => {
    const keys = rows.map(([key]) => key)
    const next = [...manualOrder.filter((key) => keys.includes(key)), ...keys.filter((key) => !manualOrder.includes(key))]
    setManualOrder(next)
    saveManualOrder(next)
    setSort('manual')
    setManage(true)
  }

  const changeListView = (view: ListView) => {
    setListView(view)
    saveListView(view)
  }

  const changePeriod = (next: PeriodView) => {
    setPeriod(next)
    localStorage.setItem(PERIOD_KEY, next)
    setSelectedEntryKey(null)
  }

  const movePeriod = (direction: -1 | 1) => {
    const next = localDate(date)
    if (period === 'day') next.setDate(next.getDate() + direction)
    if (period === 'week') next.setDate(next.getDate() + direction * 7)
    if (period === 'month') next.setMonth(next.getMonth() + direction, 1)
    setDate(dateString(next))
    setSelectedEntryKey(null)
  }

  const goToday = () => {
    setDate(todayStr())
    setSelectedEntryKey(null)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const visibleKeys = rows.map(([key]) => key)
    const current = visibleKeys.indexOf(String(active.id))
    const target = visibleKeys.indexOf(String(over.id))
    if (current < 0 || target < 0) return
    const nextVisible = arrayMove(visibleKeys, current, target)
    const hidden = manualOrder.filter((key) => !visibleKeys.includes(key))
    const next = [...nextVisible, ...hidden]
    setManualOrder(next)
    saveManualOrder(next)
  }

  const removeEntry = (entryKey: string, entry: JournalEntry) => {
    const title = titleFromContent(entry.content, entry.date)
    if (!window.confirm(`“${title}” 메모를 삭제할까요?`)) return
    deleteJournals([entryKey])
    setJournals(loadJournals())
    const next = manualOrder.filter((key) => key !== entryKey)
    setManualOrder(next)
    saveManualOrder(next)
    if (selectedEntryKey === entryKey) setSelectedEntryKey(null)
  }

  const openWrite = (d: string, entryKey?: string) => {
    setDate(d)
    onOpenWrite?.(d, entryKey)
  }

  const activateEntry = (entryKey: string, entry: JournalEntry) => {
    if (selectedEntryKey === entryKey) {
      openWrite(entry.date, entryKey)
      return
    }
    setSelectedEntryKey(entryKey)
    setDate(entry.date)
  }

  if (!ready) {
    return <p className="py-8 text-center text-xs text-muted-foreground">일지 불러오는 중…</p>
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* 상단: 날짜 · 필터 · 정렬 (최대 3) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <JournalDatePicker
          journals={calendarJournals}
          value={date}
          onChange={(d) => {
            setDate(d)
            setSelectedEntryKey(null)
          }}
          onJournalsChange={reload}
        />
        <div className="flex flex-wrap items-center gap-2">
          {period === 'day' && (
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900" role="group" aria-label="일지 보기 방식">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 gap-1.5 rounded-md px-2.5 text-xs shadow-none',
                listView === 'compact' && 'bg-white text-slate-950 shadow-sm hover:bg-white dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-800',
              )}
              aria-pressed={listView === 'compact'}
              onClick={() => changeListView('compact')}
            >
              <List className="h-3.5 w-3.5" aria-hidden />
              리스트
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 gap-1.5 rounded-md px-2.5 text-xs shadow-none',
                listView === 'cards' && 'bg-white text-slate-950 shadow-sm hover:bg-white dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-800',
              )}
              aria-pressed={listView === 'cards'}
              onClick={() => changeListView('cards')}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              카드
            </Button>
          </div>
          )}
          {period === 'day' && (
          <Button
            type="button"
            variant={manage ? 'secondary' : 'outline'}
            aria-pressed={manage}
            onClick={() => manage ? setManage(false) : enterManageMode()}
          >
            <Settings2 className="h-4 w-4" aria-hidden />
            {manage ? '완료' : '관리'}
          </Button>
          )}
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
          {period === 'day' && (
          <Button
            type="button"
            variant="outline"
            aria-label="정렬"
            onClick={() => setDrawer('sort')}
          >
            <ArrowDownUp className="h-4 w-4" aria-hidden />
            {sort === 'newest' ? '최신순' : sort === 'oldest' ? '오래된순' : '사용자 순서'}
          </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center gap-1" role="group" aria-label="일지 기간 보기">
          {([
            ['day', '하루'],
            ['week', '주간'],
            ['month', '월간'],
          ] as const).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                'h-8 rounded-lg px-3 text-xs',
                period === value && 'bg-white text-slate-950 shadow-sm hover:bg-white dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-800',
              )}
              aria-pressed={period === value}
              onClick={() => changePeriod(value)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs" onClick={goToday}>
            오늘
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="이전 기간" onClick={() => movePeriod(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-24 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
            {periodLabel(period, date)}
          </span>
          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="다음 기간" onClick={() => movePeriod(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="ml-1 rounded-full text-[10px]">
            {rows.length}개
          </Badge>
        </div>
      </div>

      {manage && extra === 'cards' && period === 'day' && (
        <p className="text-xs text-muted-foreground">
          왼쪽 손잡이를 끌어 순서를 바꾸세요. 변경한 순서는 자동 저장됩니다.
        </p>
      )}

      {!manage && extra === 'cards' && (
        <p className="text-xs text-muted-foreground">
          한 번 누르면 선택되고, 선택한 항목을 다시 누르면 상세 내용을 엽니다.
        </p>
      )}

      {extra === 'stats' ? (
        <div className="space-y-3">
          <Button type="button" variant="secondary" onClick={() => setExtra('cards')}>
            카드 목록으로
          </Button>
          <JournalStatsPanel journals={journals} />
        </div>
      ) : period === 'week' ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
          <div className="grid grid-cols-1 divide-y divide-slate-200 dark:divide-slate-800 md:grid-cols-7 md:divide-x md:divide-y-0">
            {visibleCalendarDates.map((day, index) => {
              const entries = entriesByDate.get(day) ?? []
              const isToday = day === todayStr()
              return (
                <section key={day} className={cn('min-h-44 bg-white dark:bg-slate-950 md:min-h-[25rem]', isToday && 'bg-sky-50/40 dark:bg-sky-950/10')}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 md:flex-col md:gap-1 md:text-center"
                    onClick={() => {
                      setDate(day)
                      setSelectedEntryKey(null)
                    }}
                  >
                    <span className={cn('text-[11px] font-medium', index >= 5 ? 'text-rose-500' : 'text-muted-foreground')}>
                      {WEEKDAYS[index]}
                    </span>
                    <span className={cn(
                      'flex size-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                      isToday && 'bg-blue-600 text-white shadow-sm',
                      !isToday && day === date && 'bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-slate-50',
                    )}>
                      {localDate(day).getDate()}
                    </span>
                  </button>
                  <div className="space-y-2 p-2.5">
                    {entries.length === 0 ? (
                      <p className="py-5 text-center text-[10px] text-slate-300 dark:text-slate-700">기록 없음</p>
                    ) : entries.map(([entryKey, entry]) => (
                      <CalendarJournalChip
                        key={entryKey}
                        entryKey={entryKey}
                        entry={entry}
                        selected={selectedEntryKey === entryKey}
                        showTime
                        onActivate={() => activateEntry(entryKey, entry)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      ) : period === 'month' ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
          <div className="min-w-[46rem]">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/70">
              {WEEKDAYS.map((weekday, index) => (
                <div key={weekday} className={cn('px-2 py-2 text-center text-[11px] font-medium text-muted-foreground', index >= 5 && 'text-rose-500')}>
                  {weekday}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {visibleCalendarDates.map((day, index) => {
                const entries = entriesByDate.get(day) ?? []
                const isToday = day === todayStr()
                const inMonth = day.slice(0, 7) === date.slice(0, 7)
                const visible = entries.slice(0, 3)
                return (
                  <section
                    key={day}
                    className={cn(
                      'min-h-[8.75rem] border-b border-r border-slate-100 p-1.5 dark:border-slate-800',
                      (index + 1) % 7 === 0 && 'border-r-0',
                      index >= 35 && 'border-b-0',
                      !inMonth && 'bg-slate-50/60 dark:bg-slate-900/35',
                      isToday && 'bg-sky-50/50 dark:bg-sky-950/15',
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        'mb-1.5 flex size-7 items-center justify-center rounded-full text-xs font-medium tabular-nums hover:bg-slate-100 dark:hover:bg-slate-800',
                        !inMonth && 'text-slate-300 dark:text-slate-700',
                        isToday && 'bg-blue-600 text-white shadow-sm hover:bg-blue-600 dark:hover:bg-blue-600',
                        !isToday && day === date && 'bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-slate-50',
                      )}
                      aria-label={`${day} 선택`}
                      onClick={() => {
                        setDate(day)
                        setSelectedEntryKey(null)
                      }}
                    >
                      {localDate(day).getDate()}
                    </button>
                    <div className="space-y-1">
                      {visible.map(([entryKey, entry]) => (
                        <CalendarJournalChip
                          key={entryKey}
                          entryKey={entryKey}
                          entry={entry}
                          selected={selectedEntryKey === entryKey}
                          onActivate={() => activateEntry(entryKey, entry)}
                        />
                      ))}
                      {entries.length > visible.length && (
                        <button
                          type="button"
                          className="w-full rounded px-1.5 py-0.5 text-left text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                          onClick={() => {
                            setDate(day)
                            changePeriod('week')
                          }}
                        >
                          +{entries.length - visible.length}개 더보기
                        </button>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 목록 카드 */}
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-16 text-center dark:border-slate-700">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">일지가 없습니다</p>
              <Button type="button" onClick={() => openWrite(date)} className="gap-2">
                <PenLine className="h-4 w-4" aria-hidden />
                이 날짜에 일지 작성하기
              </Button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rows.map(([key]) => key)} strategy={rectSortingStrategy}>
                <ul className={cn(
                  'grid',
                  listView === 'cards'
                    ? 'grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4'
                    : 'grid-cols-1 gap-1.5',
                )}>
                  {rows.map(([entryKey, entry]) => (
                    <SortableJournalItem
                      key={entryKey}
                      entryKey={entryKey}
                      entry={entry}
                      selected={selectedEntryKey === entryKey}
                      listView={listView}
                      manage={manage}
                      onActivate={() => activateEntry(entryKey, entry)}
                      onEdit={() => openWrite(entry.date, entryKey)}
                      onDelete={() => removeEntry(entryKey, entry)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
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
          <Button
            type="button"
            variant={sort === 'manual' ? 'default' : 'outline'}
            className="w-full justify-start"
            disabled={manualOrder.length === 0}
            onClick={() => {
              setSort('manual')
              setDrawer(null)
            }}
          >
            사용자 순서
          </Button>
        </div>
      </FilterDrawer>
    </div>
  )
}
