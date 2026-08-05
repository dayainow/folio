'use client'

/**
 * P58 — 일지 캘린더 뷰 (월/주/일 · 색상 · DnD 날짜 변경)
 */
import { useCallback, useMemo, useState, type DragEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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

export type JournalCalendarProps = {
  journals: Record<string, JournalEntry>
  selectedDate?: string | null
  onSelectDate?: (date: string) => void
  onJournalsChange?: () => void
  className?: string
}

export function JournalCalendar({
  journals,
  selectedDate,
  onSelectDate,
  onJournalsChange,
  className,
}: JournalCalendarProps) {
  const today = todayStr()
  const [mode, setMode] = useState<CalendarViewMode>('month')
  const [cursor, setCursor] = useState(() => selectedDate || today)
  const [dragDate, setDragDate] = useState<string | null>(null)

  const anchor = parseDateParts(cursor)

  const cells = useMemo(() => {
    if (mode === 'week') return buildWeekGrid(cursor, journals)
    if (mode === 'day') return [buildDayCell(cursor, journals)]
    return buildMonthGrid(anchor.year, anchor.month0, journals)
  }, [mode, cursor, journals, anchor.year, anchor.month0])

  const title = useMemo(() => {
    if (mode === 'day') return cursor
    if (mode === 'week') {
      const w = buildWeekGrid(cursor, journals)
      return `${w[0]?.date ?? ''} ~ ${w[6]?.date ?? ''}`
    }
    return `${anchor.year}년 ${anchor.month0 + 1}월`
  }, [mode, cursor, journals, anchor.year, anchor.month0])

  const navigate = (dir: -1 | 1) => {
    if (mode === 'month') {
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
    <Card className={cn('rounded-2xl border border-gray-100 p-3 dark:border-gray-800', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} aria-label="이전">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="min-w-[9rem] text-center text-sm font-semibold tabular-nums">{title}</h3>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)} aria-label="다음">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-1 h-7 text-[11px]"
            onClick={() => {
              setCursor(today)
              onSelectDate?.(today)
            }}
          >
            오늘
          </Button>
        </div>
        <div className="flex gap-1">
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
              className="h-7 text-[11px]"
              onClick={() => setMode(k)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {mode !== 'day' && (
        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS_KO.map((w) => (
            <div key={w} className="text-center text-[10px] font-medium text-muted-foreground">
              {w}
            </div>
          ))}
        </div>
      )}

      <div
        className={cn(
          'grid gap-1',
          mode === 'day' ? 'grid-cols-1' : 'grid-cols-7',
        )}
      >
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
              draggable={c.hasEntry}
              onDragStart={(e) => {
                if (!c.hasEntry) return
                setDragDate(c.date)
                e.dataTransfer.setData('text/journal-date', c.date)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(e) => onDrop(c.date, e)}
              className={cn(
                'flex min-h-[3.25rem] flex-col rounded-lg border p-1 text-left transition-colors',
                mode === 'day' && 'min-h-[8rem] p-3',
                !c.inMonth && mode === 'month' && 'opacity-40',
                c.hasEntry
                  ? 'border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/40'
                  : 'border-transparent bg-muted/40',
                c.isToday && 'ring-2 ring-amber-400/80',
                selected && 'outline outline-2 outline-offset-1 outline-primary',
              )}
              title={c.preview || c.date}
            >
              <span
                className={cn(
                  'text-[11px] tabular-nums',
                  c.isToday ? 'font-bold text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
                )}
              >
                {mode === 'day' ? c.date : c.date.slice(8)}
              </span>
              {c.hasEntry && (
                <span className={cn('mt-0.5 line-clamp-2 text-[10px] text-blue-700 dark:text-blue-300', mode === 'day' && 'line-clamp-6 text-xs')}>
                  {c.preview || '작성됨'}
                </span>
              )}
              {!c.hasEntry && mode === 'day' && (
                <span className="mt-2 text-xs text-muted-foreground">작성된 일지가 없습니다. 클릭해 작성 탭으로 이동하세요.</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <i className="h-2.5 w-2.5 rounded-sm bg-blue-400" /> 작성 있음
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/30" /> 없음
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2.5 w-2.5 rounded-sm ring-2 ring-amber-400" /> 오늘
        </span>
        <span>드래그로 날짜 이동</span>
      </div>
    </Card>
  )
}

function parseDateParts(date: string) {
  const d = new Date(date.includes('T') ? date : `${date}T12:00:00`)
  return { year: d.getFullYear(), month0: d.getMonth() }
}
