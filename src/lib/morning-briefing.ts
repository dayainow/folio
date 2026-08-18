import type { Task } from '@/lib/board'
import type { DailyReview } from '@/lib/daily-review'
import { suggestDailyPlan, type DailyPlan } from '@/lib/daily-plan'
import type { WeeklyPlan } from '@/lib/weekly-review'

export type MorningBriefing = {
  firstAction: string | null
  firstActionTaskId: string | null
  carriedTasks: Task[]
  dueToday: Task[]
  overdue: Task[]
  weeklyFocus: string[]
}

export function buildMorningBriefing(
  date: string,
  tasks: Task[],
  previousReview: DailyReview | null,
  weeklyPlan: WeeklyPlan | null,
  dailyPlans: Record<string, DailyPlan>,
): MorningBriefing {
  const openTasks = tasks.filter((task) => task.status !== 'done')
  const byId = new Map(openTasks.map((task) => [task.id, task]))
  const suggestion = suggestDailyPlan(tasks, date, weeklyPlan, dailyPlans)
  const carriedTasks = suggestion.carriedTaskIds.map((id) => byId.get(id)).filter((task): task is Task => Boolean(task))
  const dueToday = openTasks.filter((task) => task.dueDate === date)
  const overdue = openTasks.filter((task) => Boolean(task.dueDate && task.dueDate < date))
  const reviewAction = previousReview?.tomorrow.trim() || null
  const reviewTask = reviewAction
    ? openTasks.find((task) => task.title.trim().toLocaleLowerCase() === reviewAction.toLocaleLowerCase()) ?? null
    : null
  const fallbackTask = carriedTasks[0] ?? dueToday[0] ?? overdue[0] ?? null
  return {
    firstAction: reviewAction ?? fallbackTask?.title ?? null,
    firstActionTaskId: reviewTask?.id ?? (!reviewAction ? fallbackTask?.id ?? null : null),
    carriedTasks,
    dueToday,
    overdue,
    weeklyFocus: weeklyPlan?.focus.slice(0, 3) ?? [],
  }
}
