import { describe, expect, it } from 'vitest'
import {
  buildMonthGrid,
  buildWeekGrid,
  computeHourHeatmap,
  computeWritingStreak,
  journalsToEvents,
  todayStr,
} from '@/lib/calendar-engine'
import type { JournalEntry } from '@/lib/journal'

function entry(date: string, content = 'hello', updatedAt?: string): JournalEntry {
  return {
    date,
    content,
    tags: [],
    updatedAt: updatedAt ?? `${date}T14:00:00.000Z`,
  }
}

describe('calendar-engine (P58)', () => {
  const now = new Date('2026-07-15T12:00:00')

  it('builds month grid with Mon start', () => {
    const journals = {
      '2026-07-15': entry('2026-07-15'),
      '2026-07-01': entry('2026-07-01', ''),
    }
    const grid = buildMonthGrid(2026, 6, journals, now)
    expect(grid).toHaveLength(42)
    const today = grid.find((c) => c.date === '2026-07-15')
    expect(today?.isToday).toBe(true)
    expect(today?.hasEntry).toBe(true)
  })

  it('builds week and events', () => {
    const journals = { '2026-07-15': entry('2026-07-15') }
    expect(buildWeekGrid('2026-07-15', journals, now)).toHaveLength(7)
    const events = journalsToEvents(journals, now)
    expect(events[0]?.tone).toBe('today')
  })

  it('computes streak and hour heatmap', () => {
    const journals = {
      '2026-07-15': entry('2026-07-15'),
      '2026-07-14': entry('2026-07-14'),
      '2026-07-13': entry('2026-07-13'),
      '2026-07-10': entry('2026-07-10'),
    }
    const streak = computeWritingStreak(journals, now)
    expect(streak.current).toBe(3)
    expect(streak.longest).toBeGreaterThanOrEqual(3)
    const hours = computeHourHeatmap(journals)
    expect(hours).toHaveLength(24)
    expect(hours.reduce((s, h) => s + h.count, 0)).toBe(4)
  })

  it('todayStr formats', () => {
    expect(todayStr(now)).toBe('2026-07-15')
  })
})
