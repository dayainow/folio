'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { ArrowRight, CalendarClock, CornerDownRight, Sunrise, Target } from 'lucide-react'
import type { Task } from '@/lib/board'
import type { DailyReview } from '@/lib/daily-review'
import { loadDailyPlans } from '@/lib/daily-plan'
import { buildMorningBriefing, hasMorningBriefingSignals } from '@/lib/morning-briefing'
import { findWeeklyPlanForDate } from '@/lib/weekly-review'

const subscribeToHydration = () => () => undefined
let weeklyPlansRevision = 0
const subscribeToWeeklyPlans = (onStoreChange: () => void) => {
  const handleChange = () => {
    weeklyPlansRevision += 1
    onStoreChange()
  }
  window.addEventListener('folio-weekly-plan-changed', handleChange)
  return () => window.removeEventListener('folio-weekly-plan-changed', handleChange)
}
const getWeeklyPlansSnapshot = () => weeklyPlansRevision

export function MorningBriefingCard({ date, tasks, previousReview, onOpenBoard }: { date: string; tasks: Task[]; previousReview: DailyReview | null; onOpenBoard: (taskId?: string) => void }) {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false)
  const weeklyPlanRevision = useSyncExternalStore(subscribeToWeeklyPlans, getWeeklyPlansSnapshot, () => 0)
  const briefing = useMemo(
    () => {
      if (!hydrated) return null
      // The revision creates a fresh local-storage read boundary after a weekly-plan event.
      void weeklyPlanRevision
      return buildMorningBriefing(date, tasks, previousReview, findWeeklyPlanForDate(date), loadDailyPlans())
    },
    [date, hydrated, previousReview, tasks, weeklyPlanRevision],
  )

  if (!briefing || !hasMorningBriefingSignals(briefing)) return null

  return (
    <section aria-labelledby="morning-briefing-title" className="folio-surface overflow-hidden rounded-[1.5rem]">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"><Sunrise className="size-4" /></span>
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Morning briefing</p><h2 id="morning-briefing-title" className="text-sm font-semibold">오늘 시작 전, 이것만 확인하세요</h2></div>
        </div>
        <button type="button" onClick={() => onOpenBoard()} className="hidden items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground sm:flex">전체 일정 <ArrowRight className="size-3.5" /></button>
      </div>
      <div className="grid gap-px bg-border/70 sm:grid-cols-2 lg:grid-cols-4">
        <BriefingItem icon={CornerDownRight} label="첫 행동">
          {briefing.firstAction ? briefing.firstActionTaskId ? <TaskLink title={briefing.firstAction} onClick={() => onOpenBoard(briefing.firstActionTaskId!)} /> : <p className="line-clamp-2 text-sm font-medium leading-5">{briefing.firstAction}</p> : <Empty>어제 정한 첫 행동이 없습니다.</Empty>}
        </BriefingItem>
        <BriefingItem icon={ArrowRight} label={`이월 ${briefing.carriedTasks.length}`}>
          {briefing.carriedTasks.length ? <TaskList tasks={briefing.carriedTasks} onOpenBoard={onOpenBoard} /> : <Empty>어제에서 넘어온 업무가 없습니다.</Empty>}
        </BriefingItem>
        <BriefingItem icon={CalendarClock} label={`마감 ${briefing.dueToday.length} · 지연 ${briefing.overdue.length}`} tone={briefing.overdue.length ? 'danger' : undefined}>
          {briefing.dueToday.length || briefing.overdue.length ? <TaskList tasks={[...briefing.overdue, ...briefing.dueToday]} onOpenBoard={onOpenBoard} /> : <Empty>오늘 급한 마감이 없습니다.</Empty>}
        </BriefingItem>
        <BriefingItem icon={Target} label={`주간 초점 ${briefing.weeklyFocus.length}`}>
          {briefing.weeklyFocus.length ? <ul className="space-y-1">{briefing.weeklyFocus.slice(0, 2).map((focus) => <li key={focus} className="line-clamp-1 text-xs font-medium">· {focus}</li>)}</ul> : <Empty>확정된 주간 초점이 없습니다.</Empty>}
        </BriefingItem>
      </div>
    </section>
  )
}

function BriefingItem({ icon: Icon, label, tone, children }: { icon: typeof Sunrise; label: string; tone?: 'danger'; children: React.ReactNode }) {
  return <div className="min-h-28 bg-card p-4"><div className={`mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${tone === 'danger' ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}><Icon className="size-3.5" />{label}</div>{children}</div>
}

function TaskList({ tasks, onOpenBoard }: { tasks: Task[]; onOpenBoard: (taskId?: string) => void }) {
  return <div className="space-y-1">{tasks.slice(0, 2).map((task) => <TaskLink key={task.id} title={task.title} onClick={() => onOpenBoard(task.id)} />)}</div>
}

function TaskLink({ title, onClick }: { title: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="block w-full truncate text-left text-xs font-medium hover:text-teal-700 dark:hover:text-teal-300">{title}</button>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-5 text-muted-foreground">{children}</p>
}
