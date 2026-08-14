import type { Task } from '@/lib/board'
import type { JournalEntry } from '@/lib/journal'
import type { DailyReview } from '@/lib/daily-review'
import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache'
import { weekRangeOf } from '@/lib/export-advanced'

export type WeeklySnapshot = {
  from: string
  to: string
  journalDays: number
  completedTasks: Task[]
  openHighPriority: Task[]
  dailyReviews: DailyReview[]
  wins: string[]
  blockers: string[]
}

export type WeeklyPlan = {
  weekStart: string
  weekEnd: string
  focus: string[]
  reflection: string
  completedAt?: string
  updatedAt: string
}

const STORAGE_KEY = 'folio_weekly_plans_v1'

export function buildWeeklySnapshot(
  anchor: string,
  journals: Record<string, JournalEntry>,
  tasks: Task[],
  reviews: Record<string, DailyReview>,
): WeeklySnapshot {
  const { from, to } = weekRangeOf(anchor)
  const inRange = (date: string) => date >= from && date <= to
  const weekReviews = Object.values(reviews).filter((review) => inRange(review.date)).sort((a, b) => a.date.localeCompare(b.date))
  return {
    from,
    to,
    journalDays: new Set(Object.values(journals).filter((entry) => inRange(entry.date) && entry.content.trim()).map((entry) => entry.date)).size,
    completedTasks: tasks.filter((task) => task.status === 'done' && inRange((task.updatedAt || task.createdAt).slice(0, 10))),
    openHighPriority: tasks.filter((task) => task.status !== 'done' && task.priority === 'high'),
    dailyReviews: weekReviews,
    wins: weekReviews.map((review) => review.win).filter(Boolean),
    blockers: weekReviews.map((review) => review.learned).filter(Boolean),
  }
}

export function loadWeeklyPlans(): Record<string, WeeklyPlan> {
  return getLocalJson<Record<string, WeeklyPlan>>(STORAGE_KEY, {})
}

export function loadWeeklyPlan(weekStart: string): WeeklyPlan | null {
  return loadWeeklyPlans()[weekStart] ?? null
}

export function findWeeklyPlanForDate(date: string, plans = loadWeeklyPlans()): WeeklyPlan | null {
  const { from } = weekRangeOf(date)
  const current = plans[from]
  if (current?.focus.length) return current

  const previous = new Date(`${from}T12:00:00`)
  previous.setDate(previous.getDate() - 7)
  const previousStart = [previous.getFullYear(), String(previous.getMonth() + 1).padStart(2, '0'), String(previous.getDate()).padStart(2, '0')].join('-')
  const carried = plans[previousStart]
  return carried?.completedAt && carried.focus.length ? carried : null
}

export function taskFromWeeklyFocus(focus: string, tasks: Task[], now = new Date()): { task: Task; created: boolean } {
  const title = focus.trim()
  const existing = tasks.find((task) => task.status !== 'done' && task.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase())
  if (existing) return { task: existing, created: false }
  const timestamp = now.toISOString()
  return {
    created: true,
    task: {
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `weekly-${now.getTime()}`,
      title,
      description: '주간 핵심 초점에서 만든 실행 업무',
      status: 'backlog',
      priority: 'high',
      tags: ['weekly-focus'],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  }
}

export function saveWeeklyPlan(
  range: { from: string; to: string },
  input: { focus: string[]; reflection: string },
  complete = false,
): WeeklyPlan {
  const plans = loadWeeklyPlans()
  const previous = plans[range.from]
  const now = new Date().toISOString()
  const plan: WeeklyPlan = {
    weekStart: range.from,
    weekEnd: range.to,
    focus: input.focus.map((item) => item.trim()).filter(Boolean).slice(0, 3),
    reflection: input.reflection.trim(),
    updatedAt: now,
    completedAt: complete ? previous?.completedAt ?? now : previous?.completedAt,
  }
  plans[range.from] = plan
  setLocalJson(STORAGE_KEY, plans)
  flushLocalJson(STORAGE_KEY)
  return plan
}
