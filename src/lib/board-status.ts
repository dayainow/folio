/**
 * v2.0 — Board 컬럼 상태 이동 헬퍼 (순수)
 */
import type { Task } from '@/lib/board'

export const BOARD_STATUS_ORDER: Task['status'][] = [
  'backlog',
  'in_progress',
  'review',
  'done',
]

export function nextBoardStatus(status: Task['status']): Task['status'] | null {
  const i = BOARD_STATUS_ORDER.indexOf(status)
  if (i < 0 || i >= BOARD_STATUS_ORDER.length - 1) return null
  return BOARD_STATUS_ORDER[i + 1]!
}

export function prevBoardStatus(status: Task['status']): Task['status'] | null {
  const i = BOARD_STATUS_ORDER.indexOf(status)
  if (i <= 0) return null
  return BOARD_STATUS_ORDER[i - 1]!
}

export function moveTaskStatus(task: Task, status: Task['status']): Task {
  return {
    ...task,
    status,
    updatedAt: new Date().toISOString(),
  }
}
