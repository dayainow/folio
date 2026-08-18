import type { Task } from '@/lib/board'
import type { WeeklyPlan } from '@/lib/weekly-review'
import { flushLocalJson, getLocalJson, setLocalJson } from '@/lib/local-cache'

export type DailyPlan = {
  date: string
  taskIds: string[]
  confirmedAt: string
  updatedAt: string
}

export type DailyPlanSuggestion = {
  taskIds: string[]
  carriedTaskIds: string[]
}

const STORAGE_KEY = 'folio_daily_plans_v1'

function taskScore(task: Task, date: string, weeklyPlan: WeeklyPlan | null): number {
  let score = task.status === 'in_progress' ? 60 : task.status === 'review' ? 45 : 20
  score += task.priority === 'high' ? 30 : task.priority === 'medium' ? 15 : 0
  if (task.dueDate) score += task.dueDate <= date ? 35 : 5
  const normalized = task.title.trim().toLocaleLowerCase()
  if (task.tags.includes('weekly-focus') || weeklyPlan?.focus.some((focus) => focus.trim().toLocaleLowerCase() === normalized)) score += 65
  return score
}

export function recommendDailyTaskIds(tasks: Task[], date: string, weeklyPlan: WeeklyPlan | null): string[] {
  return tasks
    .filter((task) => task.status !== 'done')
    .map((task, index) => ({ task, index, score: taskScore(task, date, weeklyPlan) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map(({ task }) => task.id)
}

function previousDateKey(date: string): string {
  const previous = new Date(`${date}T00:00:00.000Z`)
  previous.setUTCDate(previous.getUTCDate() - 1)
  return previous.toISOString().slice(0, 10)
}

export function suggestDailyPlan(
  tasks: Task[],
  date: string,
  weeklyPlan: WeeklyPlan | null,
  plans = loadDailyPlans(),
): DailyPlanSuggestion {
  const openIds = new Set(tasks.filter((task) => task.status !== 'done').map((task) => task.id))
  const previous = plans[previousDateKey(date)]
  const carriedTaskIds = (previous?.taskIds ?? []).filter((id) => openIds.has(id)).slice(0, 3)
  const recommended = recommendDailyTaskIds(tasks, date, weeklyPlan).filter((id) => !carriedTaskIds.includes(id))
  return {
    carriedTaskIds,
    taskIds: [...carriedTaskIds, ...recommended].slice(0, 3),
  }
}

export function moveDailyTask(taskIds: string[], taskId: string, direction: -1 | 1): string[] {
  const index = taskIds.indexOf(taskId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= taskIds.length) return taskIds
  const next = [...taskIds]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  return next
}

export function completeDailyTask(tasks: Task[], taskId: string, now = new Date()): Task[] {
  return tasks.map((task) => task.id === taskId && task.status !== 'done'
    ? { ...task, status: 'done', updatedAt: now.toISOString() }
    : task)
}

export function loadDailyPlans(): Record<string, DailyPlan> {
  return getLocalJson<Record<string, DailyPlan>>(STORAGE_KEY, {})
}

export function loadDailyPlan(date: string): DailyPlan | null {
  return loadDailyPlans()[date] ?? null
}

export function saveDailyPlan(date: string, taskIds: string[], now = new Date()): DailyPlan {
  const plans = loadDailyPlans()
  const timestamp = now.toISOString()
  const plan: DailyPlan = {
    date,
    taskIds: [...new Set(taskIds)].slice(0, 3),
    confirmedAt: plans[date]?.confirmedAt ?? timestamp,
    updatedAt: timestamp,
  }
  plans[date] = plan
  setLocalJson(STORAGE_KEY, plans)
  flushLocalJson(STORAGE_KEY)
  return plan
}
