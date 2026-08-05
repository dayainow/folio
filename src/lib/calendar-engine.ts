/**
 * P58 — 일지 캘린더 엔진 (월/주/일 · 이벤트 · streak · 시간대 히트맵)
 */
import type { JournalEntry } from '@/lib/journal'

export type CalendarViewMode = 'month' | 'week' | 'day'

export type CalendarDayCell = {
  date: string
  /** 현재 월 그리드에서만 의미 */
  inMonth: boolean
  hasEntry: boolean
  isToday: boolean
  wordCount: number
  preview: string
}

export type CalendarEvent = {
  id: string
  date: string
  title: string
  /** 작성 있음 blue · 없음 gray · 오늘 today */
  tone: 'blue' | 'gray' | 'today'
}

export type HourHeatCell = {
  /** 0–23 */
  hour: number
  count: number
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDateStr(iso: string): Date {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

export function todayStr(now = new Date()): string {
  return toDateStr(now)
}

function previewOf(entry: JournalEntry | undefined): string {
  if (!entry?.content?.trim()) return ''
  const line = entry.content.trim().split('\n').find((l) => l.trim()) ?? ''
  return line.replace(/^#+\s*/, '').slice(0, 80)
}

function wordCount(entry: JournalEntry | undefined): number {
  if (!entry?.content) return 0
  return entry.content.trim().split(/\s+/).filter(Boolean).length
}

function cellFor(
  date: string,
  journals: Record<string, JournalEntry>,
  inMonth: boolean,
  today: string,
): CalendarDayCell {
  const entry = journals[date]
  const has = Boolean(entry?.content?.trim())
  return {
    date,
    inMonth,
    hasEntry: has,
    isToday: date === today,
    wordCount: wordCount(entry),
    preview: previewOf(entry),
  }
}

/** 월요일 시작 월간 그리드 (6주 × 7일) */
export function buildMonthGrid(
  year: number,
  month0: number,
  journals: Record<string, JournalEntry>,
  now = new Date(),
): CalendarDayCell[] {
  const today = todayStr(now)
  const first = new Date(year, month0, 1)
  const start = new Date(first)
  const dow = (first.getDay() + 6) % 7 // Mon=0
  start.setDate(first.getDate() - dow)
  const cells: CalendarDayCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const date = toDateStr(d)
    cells.push(cellFor(date, journals, d.getMonth() === month0, today))
  }
  return cells
}

/** 주간 (월~일) */
export function buildWeekGrid(
  anchor: string,
  journals: Record<string, JournalEntry>,
  now = new Date(),
): CalendarDayCell[] {
  const today = todayStr(now)
  const d = parseDateStr(anchor)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  const cells: CalendarDayCell[] = []
  for (let i = 0; i < 7; i++) {
    const x = new Date(d)
    x.setDate(d.getDate() + i)
    const date = toDateStr(x)
    cells.push(cellFor(date, journals, true, today))
  }
  return cells
}

export function buildDayCell(
  date: string,
  journals: Record<string, JournalEntry>,
  now = new Date(),
): CalendarDayCell {
  return cellFor(date, journals, true, todayStr(now))
}

/** 캘린더 이벤트(점/배지용) */
export function journalsToEvents(
  journals: Record<string, JournalEntry>,
  now = new Date(),
): CalendarEvent[] {
  const today = todayStr(now)
  return Object.keys(journals)
    .sort()
    .map((date) => {
      const entry = journals[date]
      const has = Boolean(entry?.content?.trim())
      return {
        id: date,
        date,
        title: previewOf(entry) || date,
        tone: date === today ? 'today' : has ? 'blue' : 'gray',
      }
    })
}

/** 연속 작성 일수 (오늘 또는 어제부터 역산) */
export function computeWritingStreak(
  journals: Record<string, JournalEntry>,
  now = new Date(),
): { current: number; longest: number } {
  const dates = new Set(
    Object.entries(journals)
      .filter(([, e]) => e.content?.trim())
      .map(([d]) => d),
  )
  if (dates.size === 0) return { current: 0, longest: 0 }

  const sorted = Array.from(dates).sort()
  let longest = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseDateStr(sorted[i - 1])
    const cur = parseDateStr(sorted[i])
    const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000)
    if (diff === 1) {
      run += 1
      longest = Math.max(longest, run)
    } else {
      run = 1
    }
  }

  let current = 0
  const cursor = new Date(now)
  const today = todayStr(cursor)
  const y = new Date(cursor)
  y.setDate(y.getDate() - 1)
  const yesterday = toDateStr(y)
  if (!dates.has(today) && !dates.has(yesterday)) {
    return { current: 0, longest }
  }
  if (!dates.has(today)) cursor.setDate(cursor.getDate() - 1)
  while (dates.has(toDateStr(cursor))) {
    current += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return { current, longest }
}

/** 작성 시각(updatedAt) 시간대 히트맵 */
export function computeHourHeatmap(journals: Record<string, JournalEntry>): HourHeatCell[] {
  const counts = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
  for (const e of Object.values(journals)) {
    if (!e.content?.trim()) continue
    const iso = e.updatedAt || e.createdAt
    if (!iso) continue
    const h = new Date(iso).getHours()
    if (!Number.isNaN(h)) counts[h].count += 1
  }
  return counts
}

export function shiftMonth(year: number, month0: number, delta: number): { year: number; month0: number } {
  const d = new Date(year, month0 + delta, 1)
  return { year: d.getFullYear(), month0: d.getMonth() }
}

export function shiftDate(date: string, days: number): string {
  const d = parseDateStr(date)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

export const WEEKDAY_LABELS_KO = ['월', '화', '수', '목', '금', '토', '일'] as const
