'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Task } from '@/lib/board'
import type { JournalEntry } from '@/lib/journal'
import { loadDailyReviews } from '@/lib/daily-review'
import { buildWeeklySnapshot, loadWeeklyPlan, saveWeeklyPlan } from '@/lib/weekly-review'

export function WeeklyReviewCard({ anchor, journals, tasks }: { anchor: string; journals: Record<string, JournalEntry>; tasks: Task[] }) {
  const snapshot = useMemo(() => buildWeeklySnapshot(anchor, journals, tasks, loadDailyReviews()), [anchor, journals, tasks])
  const [initial] = useState(() => loadWeeklyPlan(snapshot.from))
  const [focus, setFocus] = useState<string[]>(() => initial?.focus.length ? [...initial.focus, '', '', ''].slice(0, 3) : ['', '', ''])
  const [reflection, setReflection] = useState(initial?.reflection ?? '')
  const [complete, setComplete] = useState(Boolean(initial?.completedAt))
  const [message, setMessage] = useState('')

  const save = (finish: boolean) => {
    const result = saveWeeklyPlan(snapshot, { focus, reflection }, finish)
    setFocus([...result.focus, '', '', ''].slice(0, 3))
    if (finish) setComplete(true)
    setMessage(finish ? '이번 주를 정리하고 다음 주 초점을 확정했습니다.' : '주간 계획을 저장했습니다.')
    window.dispatchEvent(new CustomEvent('folio-weekly-plan-changed'))
  }

  return (
    <details className="folio-surface group overflow-hidden rounded-[1.35rem]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[1.35rem] px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden sm:px-6">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">주간 리뷰</h2>
          <p className="mt-1 truncate text-xs text-muted-foreground">{snapshot.from}–{snapshot.to} · 기록 {snapshot.journalDays}일 · 완료 {snapshot.completedTasks.length}개</p>
        </div>
        <div className="flex items-center gap-2">{complete ? <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">완료</span> : null}<ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" /></div>
      </summary>
      <div className="space-y-5 border-t p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="기록한 날" value={`${snapshot.journalDays}일`} />
          <Metric label="완료한 업무" value={`${snapshot.completedTasks.length}개`} />
          <Metric label="남은 중요 업무" value={`${snapshot.openHighPriority.length}개`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <section><h3 className="text-xs font-semibold">이번 주의 진전</h3>{snapshot.wins.length ? <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{snapshot.wins.slice(0, 5).map((win, index) => <li key={`${win}-${index}`}>· {win}</li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">일일 회고의 ‘잘한 일’이 여기에 모입니다.</p>}</section>
          <section><h3 className="text-xs font-semibold">주의할 맥락</h3>{snapshot.blockers.length || snapshot.openHighPriority.length ? <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{snapshot.blockers.slice(0, 3).map((item, index) => <li key={`${item}-${index}`}>· {item}</li>)}{snapshot.openHighPriority.slice(0, 3).map((task) => <li key={task.id}>· 중요 업무: {task.title}</li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">누적된 막힘이나 중요 미완료 업무가 없습니다.</p>}</section>
        </div>
        <section className="space-y-2"><h3 className="flex items-center gap-1.5 text-xs font-semibold"><Target className="size-3.5" />다음 주 핵심 초점 3가지</h3>{focus.map((value, index) => <Input key={index} value={value} onChange={(event) => setFocus((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`${index + 1}순위 목표`} className="h-9 text-xs" aria-label={`${index + 1}순위 목표`} />)}</section>
        <label className="block space-y-1.5"><span className="text-xs font-semibold">한 주를 마치며</span><Textarea value={reflection} onChange={(event) => setReflection(event.target.value)} rows={3} placeholder="유지할 것과 다음 주에 바꿀 것을 적어보세요." className="text-sm" /></label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] text-muted-foreground" role="status">{message || '저장 전에는 다음 주 계획으로 확정되지 않습니다.'}</p><div className="grid grid-cols-2 gap-2 sm:flex"><Button variant="outline" size="sm" className="h-11 rounded-full sm:h-9" onClick={() => save(false)} disabled={!focus.some((item) => item.trim()) && !reflection.trim()}>저장</Button><Button size="sm" className="h-11 gap-1.5 rounded-full sm:h-9" onClick={() => save(true)} disabled={!focus.some((item) => item.trim())}><CheckCircle2 className="size-3.5" />리뷰 완료</Button></div></div>
      </div>
    </details>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-foreground/[0.07] bg-background p-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div>
}
