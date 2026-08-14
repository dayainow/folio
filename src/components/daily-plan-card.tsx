'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, CheckCircle2, Plus, RotateCcw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Task } from '@/lib/board'
import { loadDailyPlan, moveDailyTask, recommendDailyTaskIds, saveDailyPlan } from '@/lib/daily-plan'
import { findWeeklyPlanForDate } from '@/lib/weekly-review'
import { cn } from '@/lib/utils'

export function DailyPlanCard({ date, tasks, onOpenBoard }: { date: string; tasks: Task[]; onOpenBoard: (taskId?: string) => void }) {
  const openTasks = useMemo(() => tasks.filter((task) => task.status !== 'done'), [tasks])
  const [taskIds, setTaskIds] = useState<string[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('')

  const recommend = useCallback(() => {
    setTaskIds(recommendDailyTaskIds(tasks, date, findWeeklyPlanForDate(date)))
    setConfirmed(false)
    setMessage('')
  }, [date, tasks])

  useEffect(() => {
    const stored = loadDailyPlan(date)
    if (stored) {
      setTaskIds(stored.taskIds.filter((id) => tasks.some((task) => task.id === id)))
      setConfirmed(true)
    } else {
      setTaskIds(recommendDailyTaskIds(tasks, date, findWeeklyPlanForDate(date)))
    }
    setReady(true)
  }, [date, tasks])

  if (!ready || openTasks.length === 0) return null

  const selectedTasks = taskIds.map((id) => tasks.find((task) => task.id === id)).filter((task): task is Task => Boolean(task))
  const candidates = openTasks.filter((task) => !taskIds.includes(task.id)).slice(0, 3)
  const confirm = () => {
    saveDailyPlan(date, taskIds)
    setConfirmed(true)
    setMessage('오늘의 Top 3를 확정했습니다.')
  }

  return (
    <section aria-labelledby="daily-plan-title" className="folio-surface rounded-[1.5rem] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-sky-600 text-white"><Sparkles className="size-4" /></span>
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Daily plan</p><h2 id="daily-plan-title" className="text-sm font-semibold">오늘의 Top 3</h2></div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">상태·마감·우선순위·주간 초점을 반영한 추천입니다.</p>
        </div>
        <Button variant="ghost" size="sm" className="self-start gap-1.5 rounded-full text-xs" onClick={recommend}><RotateCcw className="size-3.5" />다시 추천</Button>
      </div>

      <div className="mt-4 space-y-2">
        {selectedTasks.map((task, index) => (
          <div key={task.id} className="flex items-center gap-2 rounded-xl border bg-background p-2.5">
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold', index === 0 ? 'bg-sky-600 text-white' : 'bg-muted text-muted-foreground')}>{index + 1}</span>
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpenBoard(task.id)}>
              <span className="block truncate text-sm font-medium">{task.title}</span>
              <span className="text-[10px] text-muted-foreground">{task.status === 'in_progress' ? '진행 중' : task.status === 'review' ? '검토 중' : '대기'} · {task.priority === 'high' ? '높음' : task.priority === 'medium' ? '보통' : '낮음'}</span>
            </button>
            <div className="flex gap-0.5">
              <Button variant="ghost" size="icon" className="size-7" onClick={() => { setTaskIds(moveDailyTask(taskIds, task.id, -1)); setConfirmed(false) }} disabled={index === 0} aria-label={`${task.title} 순서 올리기`}><ArrowUp className="size-3.5" /></Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => { setTaskIds(moveDailyTask(taskIds, task.id, 1)); setConfirmed(false) }} disabled={index === selectedTasks.length - 1} aria-label={`${task.title} 순서 내리기`}><ArrowDown className="size-3.5" /></Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => { setTaskIds(taskIds.filter((id) => id !== task.id)); setConfirmed(false) }} aria-label={`${task.title} 오늘 계획에서 빼기`}><X className="size-3.5" /></Button>
            </div>
          </div>
        ))}
        {taskIds.length < 3 && candidates.length ? (
          <div className="flex flex-wrap gap-1.5 pt-1" aria-label="오늘 계획 후보">
            {candidates.map((task) => <Button key={task.id} variant="outline" size="sm" className="h-8 gap-1 rounded-full text-[11px]" onClick={() => { setTaskIds([...taskIds, task.id].slice(0, 3)); setConfirmed(false) }}><Plus className="size-3" />{task.title}</Button>)}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
        <p className="text-[11px] text-muted-foreground" role="status">{message || (confirmed ? '오늘의 실행 순서가 확정되어 있습니다.' : '확정 전에는 오늘 계획으로 저장되지 않습니다.')}</p>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" size="sm" className="gap-1 rounded-full text-xs" onClick={() => onOpenBoard()}>전체 일정 <ArrowRight className="size-3.5" /></Button>
          <Button size="sm" className="gap-1.5 rounded-full" onClick={confirm} disabled={!taskIds.length || confirmed}><CheckCircle2 className="size-3.5" />Top 3 확정</Button>
        </div>
      </div>
    </section>
  )
}
