import { describe, expect, it } from 'vitest'
import {
  computeBoardAnalytics,
  computeJournalAnalytics,
  computeProductivityScore,
  rangeStart,
  taskPriorityWeight,
} from '@/lib/analytics'
import type { JournalEntry } from '@/lib/journal'
import type { Task } from '@/lib/board'

const now = new Date('2026-08-03T12:00:00.000Z')

describe('rangeStart', () => {
  it('returns null for all', () => {
    expect(rangeStart('all', now)).toBeNull()
  })

  it('returns ~1 week ago for 1w', () => {
    expect(rangeStart('1w', now)).toBe('2026-07-28')
  })

  it('returns ~1 month ago for 1m', () => {
    expect(rangeStart('1m', now)).toBe('2026-07-03')
  })
})

describe('computeProductivityScore', () => {
  it('weights journal/docs/tasks', () => {
    expect(
      computeProductivityScore({ journalCount: 2, docCount: 1, weightedTaskScore: 50 }),
    ).toBe(2 * 15 + 15 + 50)
  })

  it('is zero when empty', () => {
    expect(computeProductivityScore({ journalCount: 0, docCount: 0, weightedTaskScore: 0 })).toBe(0)
  })
})

describe('taskPriorityWeight', () => {
  it('maps priorities', () => {
    expect(taskPriorityWeight('high')).toBe(50)
    expect(taskPriorityWeight('medium')).toBe(30)
    expect(taskPriorityWeight('low')).toBe(15)
  })
})

describe('computeJournalAnalytics', () => {
  const entries: Record<string, JournalEntry> = {
    '2026-08-01': {
      date: '2026-08-01',
      content: 'one two three',
      tags: ['work', 'focus'],
      updatedAt: '',
    },
    '2026-08-02': {
      date: '2026-08-02',
      content: 'hello',
      tags: ['work'],
      updatedAt: '',
    },
    '2025-01-01': {
      date: '2025-01-01',
      content: 'old',
      tags: [],
      updatedAt: '',
    },
  }

  it('filters by range and aggregates words/tags', () => {
    const a = computeJournalAnalytics(entries, '1m', now)
    expect(a.totalEntries).toBe(2)
    expect(a.totalWords).toBe(4)
    expect(a.tags.find((t) => t.tag === 'work')?.count).toBe(2)
  })

  it('includes all when range=all', () => {
    const a = computeJournalAnalytics(entries, 'all', now)
    expect(a.totalEntries).toBe(3)
  })
})

describe('computeBoardAnalytics', () => {
  const tasks: Task[] = [
    {
      id: '1',
      title: 'A',
      description: '',
      status: 'backlog',
      priority: 'low',
      tags: [],
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    {
      id: '2',
      title: 'B',
      description: '',
      status: 'done',
      priority: 'high',
      tags: [],
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T12:00:00.000Z',
    },
  ]

  it('counts columns and completed', () => {
    const a = computeBoardAnalytics(tasks, '1m', now)
    expect(a.totalTasks).toBe(2)
    expect(a.completedCount).toBe(1)
    expect(a.columns.find((c) => c.status === 'backlog')?.count).toBe(1)
    expect(a.columns.find((c) => c.status === 'done')?.count).toBe(1)
  })
})
