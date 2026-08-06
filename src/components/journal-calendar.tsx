'use client'

/**
 * P58/P62 — 일지 캘린더 (전체 뷰 · 월간 팝업)
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { JournalEntry } from '@/lib/journal'
import { moveJournalDate } from '@/lib/journal'
import {
  buildDayCell,
  buildMonthGrid,
  buildWeekGrid,
  shiftDate,
  shiftMonth,
  todayStr,
  WEEKDAY_LABELS_KO,
  type CalendarViewMode,
} from '@/lib/calendar-engine'
import { useEscapeToClose } from '@/lib/a11y'

export type JournalCalendarProps = {
  journals: Record<string, JournalEntry>
  selectedDate?: string | null
  onSelectDate?: (date: string) => void
  onJournalsChange?: () => void
  className?: string
  /** P62 — 월간 팝업만 */
  variant?: 'full' | 'popup'
}

export function JournalCalendar({
  journals,
  selectedDate,
  onSelectDate,
  onJournalsChange,
  className,
  variant = 'full',
}: JournalCalendarProps) {
  const today = todayStr()
  const [mode, setMode] = useState<CalendarViewMode>('month')
  const [cursor, setCursor] = useState(() => selectedDate || today)
  const [dragDate, setDragDate] = useState<string | null>(null)

  const anchor = parseDateParts(cursor)
  const popupOnly = variant === 'popup'

  const cells = useMemo(() => {
    if (!popupOnly && mode === 'week') return buildWeekGrid(cursor, journals)
    if (!popupOnly && mode === 'day') return [buildDayCell(cursor, journals)]
    return buildMonthGrid(anchor.year, anchor.month0, journals)
  }, [mode, cursor, journals, anchor.year, anchor.month0, popupOnly])

  const title = useMemo(() => {
    if (!popupOnly && mode === 'day') return cursor
    if (!popupOnly && mode === 'week') {
      const w = buildWeekGrid(cursor, journals)
      return `${w[0]?.date ?? ''} ~ ${w[6]?.date ?? ''}`
    }
    return `${anchor.year}년 ${anchor.month0 + 1}월`
  }, [mode, cursor, journals, anchor.year, anchor.month0, popupOnly])

  const navigate = (dir: -1 | 1) => {
    if (popupOnly || mode === 'month') {
      const next = shiftMonth(anchor.year, anchor.month0, dir)
      setCursor(`${next.year}-${String(next.month0 + 1).padStart(2, '0')}-01`)
      return
    }
    if (mode === 'week') setCursor(shiftDate(cursor, dir * 7))
    else setCursor(shiftDate(cursor, dir))
  }

  const onDrop = useCallback(
    (targetDate: string, e: DragEvent) => {
      e.preventDefault()
      const from = e.dataTransfer.getData('text/journal-date') || dragDate
      setDragDate(null)
      if (!from || from === targetDate) return
      const ok = moveJournalDate(from, targetDate)
      if (!ok) {
        window.alert('대상 날짜에 이미 일지가 있어 이동할 수 없습니다.')
        return
      }
      onJournalsChange?.()
      onSelectDate?.(targetDate)
      setCursor(targetDate)
    },
    [dragDate, onJournalsChange, onSelectDate],
  )

  return (
    <Card
      className={cn(
        'rounded-2xl border border-slate-100 p-3 shadow-sm dark:border-slate-800',
        popupOnly && 'rounded-xl border-slate-200 p-2.5 shadow-sm',
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="이전">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="min-w-[8rem] text-center text-sm font-semibold tabular-nums">{title}</h3>
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(1)} aria-label="다음">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="ml-1"
            onClick={() => {
              setCursor(today)
              onSelectDate?.(today)
            }}
          >
            오늘
          </Button>
        </div>
        {!popupOnly && (
          <div className="flex gap-2">
            {([
              ['month', '월간'],
              ['week', '주간'],
              ['day', '일간'],
            ] as const).map(([k, label]) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant={mode === k ? 'default' : 'outline'}
                onClick={() => setMode(k)}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {(popupOnly || mode !== 'day') && (
        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS_KO.map((w) => (
            <div key={w} className="text-center text-[10px] font-medium text-muted-foreground">
              {w}
            </div>
          ))}
        </div>
      )}

      <div className={cn('grid gap-1', !popupOnly && mode === 'day' ? 'grid-cols-1' : 'grid-cols-7')}>
        {cells.map((c) => {
          const selected = selectedDate === c.date
          return (
            <button
              key={c.date}
              type="button"
              onClick={() => {
                setCursor(c.date)
                onSelectDate?.(c.date)
              }}
              draggable={!popupOnly && c.hasEntry}
              onDragStart={(e) => {
                if (popupOnly || !c.hasEntry) return
                setDragDate(c.date)
                e.dataTransfer.setData('text/journal-date', c.date)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                if (popupOnly) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(e) => {
                if (popupOnly) return
                onDrop(c.date, e)
              }}
              className={cn(
                'flex min-h-11 flex-col rounded-lg border p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900',
                !popupOnly && mode === 'day' && 'min-h-[8rem] p-3',
                !c.inMonth && (popupOnly || mode === 'month') && 'opacity-40',
                c.hasEntry
                  ? 'border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/40'
                  : 'border-transparent bg-muted/40',
                c.isToday && 'ring-2 ring-amber-400/80',
                selected && 'outline outline-2 outline-offset-1 outline-slate-900',
              )}
              title={c.preview || c.date}
              aria-label={`${c.date}${c.hasEntry ? ' 작성됨' : ''}`}
              aria-pressed={selected}
            >
              <span
                className={cn(
                  'text-[11px] tabular-nums',
                  c.isToday ? 'font-bold text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
                )}
              >
                {!popupOnly && mode === 'day' ? c.date : c.date.slice(8)}
              </span>
              {c.hasEntry && !popupOnly && (
                <span
                  className={cn(
                    'mt-0.5 line-clamp-2 text-[10px] text-blue-700 dark:text-blue-300',
                    mode === 'day' && 'line-clamp-6 text-xs',
                  )}
                >
                  {c.preview || '작성됨'}
                </span>
              )}
              {c.hasEntry && popupOnly && (
                <span className="mt-0.5 h-1.5 w-1.5 self-center rounded-full bg-blue-500" aria-hidden />
              )}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

/** P62 — 달력 아이콘 → 월간 팝업 */
export function JournalDatePicker({
  journals,
  value,
  onChange,
  onJournalsChange,
}: {
  journals: Record<string, JournalEntry>
  value: string
  onChange: (date: string) => void
  onJournalsChange?: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEscapeToClose(open, () => setOpen(false))

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={rootRef} className="relative inline-flex">
      <Button
        type="button"
        variant="outline"
        className="min-w-[9.5rem] justify-start gap-2 tabular-nums"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="날짜 선택"
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden />
        {value}
      </Button>
      {open && (
        <div
          className="absolute left-0 top-full z-40 mt-2 w-[min(100vw-2rem,20rem)]"
          role="dialog"
          aria-label="월간 캘린더"
        >
          <JournalCalendar
            variant="popup"
            journals={journals}
            selectedDate={value}
            onSelectDate={(d) => {
              onChange(d)
              setOpen(false)
            }}
            onJournalsChange={onJournalsChange}
          />
        </div>
      )}
    </div>
  )
}

function parseDateParts(date: string) {
  const d = new Date(date.includes('T') ? date : `${date}T12:00:00`)
  return { year: d.getFullYear(), month0: d.getMonth() }
}
