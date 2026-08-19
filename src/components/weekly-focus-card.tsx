'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, ListPlus, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { saveTasksWithFallback, type Task } from '@/lib/board'
import { findWeeklyPlanForDate, taskFromWeeklyFocus, type WeeklyPlan } from '@/lib/weekly-review'

export function WeeklyFocusCard({ date, tasks, onOpenBoard }: { date: string; tasks: Task[]; onOpenBoard: (taskId?: string) => void }) {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [localTasks, setLocalTasks] = useState(tasks)
  const [working, setWorking] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const refreshPlan = useCallback(() => setPlan(findWeeklyPlanForDate(date)), [date])
  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) refreshPlan()
    })
    window.addEventListener('folio-weekly-plan-changed', refreshPlan)
    return () => {
      cancelled = true
      window.removeEventListener('folio-weekly-plan-changed', refreshPlan)
    }
  }, [refreshPlan])
  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setLocalTasks(tasks)
    })
    return () => {
      cancelled = true
    }
  }, [tasks])

  const openTitles = useMemo(
    () => new Set(localTasks.filter((task) => task.status !== 'done').map((task) => task.title.trim().toLocaleLowerCase())),
    [localTasks],
  )

  if (!plan?.focus.length) return null

  const createTask = async (focus: string) => {
    const result = taskFromWeeklyFocus(focus, localTasks)
    if (!result.created) {
      onOpenBoard(result.task.id)
      return
    }
    setWorking(focus)
    setMessage('')
    try {
      const next = [...localTasks, result.task]
      setLocalTasks(next)
      await saveTasksWithFallback(next)
      setMessage(`“${focus}”을 실행 업무로 만들었습니다.`)
      window.dispatchEvent(new CustomEvent('folio-tasks-changed'))
    } finally {
      setWorking(null)
    }
  }

  return (
    <section aria-labelledby="weekly-focus-title" className="folio-surface overflow-hidden rounded-[1.5rem] border-teal-700/10">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-teal-600 text-white"><Target className="size-4" /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Weekly focus</p>
              <h2 id="weekly-focus-title" className="text-sm font-semibold">이번 주 집중할 것</h2>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">리뷰에서 정한 방향을 오늘의 실행 업무로 연결하세요.</p>
        </div>
        <Button variant="ghost" size="sm" className="self-start gap-1 rounded-full text-xs sm:self-auto" onClick={() => onOpenBoard()}>
          전체 일정 <ArrowRight className="size-3.5" />
        </Button>
      </div>
      <div className="grid gap-px border-t bg-border/70 sm:grid-cols-3">
        {plan.focus.map((focus, index) => {
          const exists = openTitles.has(focus.trim().toLocaleLowerCase())
          return (
            <div key={`${focus}-${index}`} className="flex min-h-28 flex-col justify-between gap-3 bg-card p-4">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 text-[10px] font-semibold tabular-nums text-teal-700 dark:text-teal-300">0{index + 1}</span>
                <p className="text-sm font-medium leading-5">{focus}</p>
              </div>
              <Button
                variant={exists ? 'ghost' : 'outline'}
                size="sm"
                className="h-8 justify-start gap-1.5 rounded-full px-3 text-[11px]"
                onClick={() => void createTask(focus)}
                disabled={working === focus}
                aria-label={exists ? `${focus} 업무 열기` : `${focus} 실행 업무 만들기`}
              >
                {exists ? <Check className="size-3.5 text-teal-600" /> : <ListPlus className="size-3.5" />}
                {exists ? '실행 업무 열기' : working === focus ? '만드는 중…' : '실행 업무 만들기'}
              </Button>
            </div>
          )
        })}
      </div>
      <p className="px-4 py-2.5 text-[11px] text-muted-foreground" role="status">{message || `${plan.weekStart}에 확정한 초점`}</p>
    </section>
  )
}
