import { describe, expect, it, vi } from 'vitest'
import type { JournalEntry } from '@/lib/journal'
import {
  createJournalEntryKey,
  dailyJourneyPhase,
  journalExcerpt,
  journalTitle,
  localDateKey,
  selectMemoryMoments,
} from '@/lib/personal-assistant'

function entry(date: string, content: string): JournalEntry {
  return {
    id: `${date}-${content}`,
    date,
    content,
    tags: [],
    createdAt: `${date}T09:00:00.000Z`,
    updatedAt: `${date}T09:00:00.000Z`,
  }
}

describe('personal assistant helpers', () => {
  it('uses local calendar dates instead of UTC dates', () => {
    expect(localDateKey(new Date(2026, 7, 13, 23, 30))).toBe('2026-08-13')
  })

  it('creates a unique journal key while preserving the date prefix', () => {
    const uuid = vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')
    expect(createJournalEntryKey('2026-08-13')).toBe(
      '2026-08-13--00000000-0000-4000-8000-000000000001',
    )
    uuid.mockRestore()
  })

  it('extracts readable titles and excerpts from markdown', () => {
    const content = '# 오늘 배운 점\n\n**작은 기록**을 계속 남기기로 했다.'
    expect(journalTitle(content)).toBe('오늘 배운 점')
    expect(journalExcerpt(content)).toContain('오늘 배운 점')
  })

  it('selects the daily journey phase from the local hour', () => {
    expect(dailyJourneyPhase(new Date(2026, 7, 13, 9))).toBe('plan')
    expect(dailyJourneyPhase(new Date(2026, 7, 13, 14))).toBe('capture')
    expect(dailyJourneyPhase(new Date(2026, 7, 13, 20))).toBe('review')
  })

  it('resurfaces anchored memories before recent fallback entries', () => {
    const journals = {
      yesterday: entry('2026-08-12', '어제 기록'),
      week: entry('2026-08-06', '일주일 전 기록'),
      recent: entry('2026-08-10', '최근 기록'),
    }
    const moments = selectMemoryMoments(journals, new Date(2026, 7, 13, 12), 3)
    expect(moments.map((moment) => moment.label)).toEqual(['어제', '일주일 전', '지난 기록'])
    expect(moments.map((moment) => moment.entryKey)).toEqual(['yesterday', 'week', 'recent'])
  })
})
