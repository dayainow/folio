import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache'
import type { Task } from '@/lib/board'
import { loadDailyPlan, type DailyPlan } from '@/lib/daily-plan'

export type DailyExecutionSummary = {
  planned: number
  completed: number
  open: number
  completedTaskIds: string[]
  openTaskIds: string[]
}

export type DailyReview = {
  date: string
  win: string
  learned: string
  tomorrow: string
  execution?: DailyExecutionSummary
  completedAt?: string
  updatedAt: string
}

const STORAGE_KEY = 'folio_daily_reviews_v1'

export function buildDailyExecutionSummary(date: string, tasks: Task[], plan: DailyPlan | null = loadDailyPlan(date)): DailyExecutionSummary {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const plannedTaskIds = (plan?.taskIds ?? []).filter((id) => byId.has(id))
  const completedTaskIds = plannedTaskIds.filter((id) => byId.get(id)?.status === 'done')
  const openTaskIds = plannedTaskIds.filter((id) => {
    const task = byId.get(id)
    return task && task.status !== 'done'
  })
  return {
    planned: plannedTaskIds.length,
    completed: completedTaskIds.length,
    open: openTaskIds.length,
    completedTaskIds,
    openTaskIds,
  }
}

export function suggestTomorrowAction(execution: DailyExecutionSummary, tasks: Task[]): string | null {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  for (const id of execution.openTaskIds) {
    const task = byId.get(id)
    if (task && task.status !== 'done' && task.title.trim()) return task.title.trim()
  }
  return null
}

export function loadDailyReviews(): Record<string, DailyReview> {
  return getLocalJson<Record<string, DailyReview>>(STORAGE_KEY, {})
}

export function loadDailyReview(date: string): DailyReview | null {
  return loadDailyReviews()[date] ?? null
}

export function saveDailyReview(
  date: string,
  input: Pick<DailyReview, 'win' | 'learned' | 'tomorrow'> & { execution?: DailyExecutionSummary },
  complete = false,
): DailyReview {
  const reviews = loadDailyReviews()
  const previous = reviews[date]
  const now = new Date().toISOString()
  const review: DailyReview = {
    date,
    win: input.win.trim(),
    learned: input.learned.trim(),
    tomorrow: input.tomorrow.trim(),
    execution: input.execution ?? previous?.execution,
    updatedAt: now,
    completedAt: complete ? previous?.completedAt ?? now : previous?.completedAt,
  }
  reviews[date] = review
  setLocalJson(STORAGE_KEY, reviews)
  flushLocalJson(STORAGE_KEY)
  return review
}

export function isDailyReviewComplete(review: DailyReview | null): boolean {
  return Boolean(review?.completedAt && (review.win || review.learned || review.tomorrow))
}
