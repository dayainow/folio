import { beforeEach, describe, expect, it } from 'vitest'
import { buildWeeklySnapshot, loadWeeklyPlan, saveWeeklyPlan } from '@/lib/weekly-review'
import type { Task } from '@/lib/board'

describe('weekly personal review', () => {
  beforeEach(() => localStorage.clear())

  it('summarizes journals, completed work, priorities and daily reviews', () => {
    const tasks: Task[] = [
      { id: 'done', title: '출시', description: '', status: 'done', priority: 'medium', tags: [], createdAt: '2026-08-10T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z' },
      { id: 'high', title: '보안 검토', description: '', status: 'backlog', priority: 'high', tags: [], createdAt: '2026-08-14T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z' },
    ]
    const snapshot = buildWeeklySnapshot('2026-08-14', {
      a: { date: '2026-08-11', content: '기록', tags: [], updatedAt: '2026-08-11T00:00:00.000Z' },
      b: { date: '2026-08-13', content: '또 기록', tags: [], updatedAt: '2026-08-13T00:00:00.000Z' },
    }, tasks, {
      a: { date: '2026-08-13', win: '검색 완성', learned: '평가셋 필요', tomorrow: '', updatedAt: '2026-08-13T00:00:00.000Z' },
    })
    expect(snapshot).toMatchObject({ from: '2026-08-10', to: '2026-08-16', journalDays: 2 })
    expect(snapshot.completedTasks).toHaveLength(1)
    expect(snapshot.openHighPriority[0]?.title).toBe('보안 검토')
    expect(snapshot.wins).toEqual(['검색 완성'])
  })

  it('stores at most three focus items and completes explicitly', () => {
    const plan = saveWeeklyPlan({ from: '2026-08-10', to: '2026-08-16' }, { focus: ['A', 'B', 'C', 'D'], reflection: 'keep' }, true)
    expect(plan.focus).toEqual(['A', 'B', 'C'])
    expect(plan.completedAt).toBeTruthy()
    expect(loadWeeklyPlan('2026-08-10')?.reflection).toBe('keep')
  })
})
