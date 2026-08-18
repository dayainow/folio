import { describe, expect, it } from 'vitest'
import type { Task } from '@/lib/board'
import { buildMorningBriefing, hasMorningBriefingSignals } from '@/lib/morning-briefing'

const task = (id: string, partial: Partial<Task> = {}): Task => ({
  id, title: id, description: '', status: 'backlog', priority: 'medium', tags: [], createdAt: '2026-08-17T00:00:00.000Z', updatedAt: '2026-08-17T00:00:00.000Z', ...partial,
})

describe('morning briefing', () => {
  it('summarizes yesterday action, carryover, deadlines and weekly focus from open work', () => {
    const tasks = [
      task('carry', { title: '이어 할 일' }),
      task('due', { title: '오늘 마감', dueDate: '2026-08-18' }),
      task('late', { title: '지연 업무', dueDate: '2026-08-17' }),
      task('done', { title: '끝난 업무', status: 'done', dueDate: '2026-08-18' }),
    ]
    const briefing = buildMorningBriefing(
      '2026-08-18',
      tasks,
      { date: '2026-08-17', win: '', learned: '', tomorrow: '이어 할 일', updatedAt: '2026-08-17T09:00:00.000Z' },
      { weekStart: '2026-08-17', weekEnd: '2026-08-23', focus: ['출시 준비'], reflection: '', updatedAt: '2026-08-17T09:00:00.000Z' },
      { '2026-08-17': { date: '2026-08-17', taskIds: ['carry', 'done'], confirmedAt: '2026-08-17T08:00:00.000Z', updatedAt: '2026-08-17T08:00:00.000Z' } },
    )
    expect(briefing.firstActionTaskId).toBe('carry')
    expect(briefing.carriedTasks.map(({ id }) => id)).toEqual(['carry'])
    expect(briefing.dueToday.map(({ id }) => id)).toEqual(['due'])
    expect(briefing.overdue.map(({ id }) => id)).toEqual(['late'])
    expect(briefing.weeklyFocus).toEqual(['출시 준비'])
  })

  it('falls back to carryover when yesterday has no explicit first action', () => {
    const tasks = [task('carry')]
    const briefing = buildMorningBriefing('2026-08-18', tasks, null, null, {
      '2026-08-17': { date: '2026-08-17', taskIds: ['carry'], confirmedAt: '2026-08-17T08:00:00.000Z', updatedAt: '2026-08-17T08:00:00.000Z' },
    })
    expect(briefing).toMatchObject({ firstAction: 'carry', firstActionTaskId: 'carry' })
  })

  it('does not surface a briefing until there is something useful to review', () => {
    const empty = buildMorningBriefing('2026-08-18', [], null, null, {})
    expect(hasMorningBriefingSignals(empty)).toBe(false)
    expect(hasMorningBriefingSignals({ ...empty, weeklyFocus: ['출시 준비'] })).toBe(true)
  })
})
