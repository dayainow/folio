import { beforeEach, describe, expect, it } from 'vitest'
import { completeDailyTask, loadDailyPlan, moveDailyTask, recommendDailyTaskIds, saveDailyPlan } from '@/lib/daily-plan'
import type { Task } from '@/lib/board'

const task = (id: string, partial: Partial<Task> = {}): Task => ({
  id,
  title: id,
  description: '',
  status: 'backlog',
  priority: 'low',
  tags: [],
  createdAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
  ...partial,
})

describe('daily top three plan', () => {
  beforeEach(() => localStorage.clear())

  it('prioritizes weekly focus, overdue and active work', () => {
    const tasks = [
      task('low'),
      task('active', { status: 'in_progress' }),
      task('due', { priority: 'high', dueDate: '2026-08-14' }),
      task('focus', { tags: ['weekly-focus'] }),
      task('done', { status: 'done', priority: 'high' }),
    ]
    expect(recommendDailyTaskIds(tasks, '2026-08-14', null)).toEqual(['due', 'focus', 'active'])
  })

  it('reorders safely and persists at most three unique tasks', () => {
    expect(moveDailyTask(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveDailyTask(['a'], 'a', -1)).toEqual(['a'])
    const plan = saveDailyPlan('2026-08-14', ['a', 'b', 'a', 'c', 'd'], new Date('2026-08-14T08:00:00.000Z'))
    expect(plan.taskIds).toEqual(['a', 'b', 'c'])
    expect(loadDailyPlan('2026-08-14')).toEqual(plan)
  })

  it('completes only the selected task and updates its timestamp', () => {
    const tasks = [task('a'), task('b', { status: 'in_progress' })]
    const next = completeDailyTask(tasks, 'b', new Date('2026-08-18T09:30:00.000Z'))
    expect(next[0]).toBe(tasks[0])
    expect(next[1]).toMatchObject({ id: 'b', status: 'done', updatedAt: '2026-08-18T09:30:00.000Z' })
    expect(tasks[1]?.status).toBe('in_progress')
  })
})
