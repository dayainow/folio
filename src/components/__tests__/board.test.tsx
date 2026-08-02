import { beforeEach, describe, expect, it } from 'vitest'
import { loadTasks, saveTasks, type Task } from '@/lib/board'
import {
  BOARD_STATUS_ORDER,
  moveTaskStatus,
  nextBoardStatus,
  prevBoardStatus,
} from '@/lib/board-status'

function task(partial: Partial<Task> & Pick<Task, 'id' | 'status'>): Task {
  return {
    title: partial.title ?? 'T',
    description: partial.description ?? '',
    priority: partial.priority ?? 'medium',
    tags: partial.tags ?? [],
    createdAt: partial.createdAt ?? '2026-08-01T00:00:00.000Z',
    updatedAt: partial.updatedAt ?? '2026-08-01T00:00:00.000Z',
    ...partial,
  }
}

describe('board status movement (DnD equivalent)', () => {
  it('orders columns backlog → done', () => {
    expect(BOARD_STATUS_ORDER).toEqual(['backlog', 'in_progress', 'review', 'done'])
  })

  it('nextBoardStatus advances', () => {
    expect(nextBoardStatus('backlog')).toBe('in_progress')
    expect(nextBoardStatus('in_progress')).toBe('review')
    expect(nextBoardStatus('review')).toBe('done')
    expect(nextBoardStatus('done')).toBeNull()
  })

  it('prevBoardStatus retreats', () => {
    expect(prevBoardStatus('done')).toBe('review')
    expect(prevBoardStatus('backlog')).toBeNull()
  })

  it('moveTaskStatus updates status and updatedAt', () => {
    const t = task({ id: '1', status: 'backlog' })
    const moved = moveTaskStatus(t, 'in_progress')
    expect(moved.status).toBe('in_progress')
    expect(moved.updatedAt >= t.updatedAt).toBe(true)
  })
})

describe('board local persistence', () => {
  beforeEach(() => localStorage.clear())

  it('saves and loads tasks', () => {
    const rows = [task({ id: 'a', status: 'backlog', title: 'Ship' })]
    saveTasks(rows)
    expect(loadTasks()[0]?.title).toBe('Ship')
  })

  it('status move persists', () => {
    const rows = [task({ id: 'a', status: 'backlog' })]
    saveTasks(rows)
    const next = moveTaskStatus(loadTasks()[0]!, 'review')
    saveTasks([next])
    expect(loadTasks()[0]?.status).toBe('review')
  })
})
