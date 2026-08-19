'use client'

import { useId, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ClipboardCheck, Sparkles, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { buildDailyExecutionSummary, isDailyReviewComplete, loadDailyReview, saveDailyReview, suggestTomorrowAction } from '@/lib/daily-review'
import type { Task } from '@/lib/board'

export function DailyReviewCard({
  date,
  tasks,
  journalCount,
  initiallyExpanded = false,
}: {
  date: string
  tasks: Task[]
  journalCount: number
  initiallyExpanded?: boolean
}) {
  const execution = useMemo(() => buildDailyExecutionSummary(date, tasks), [date, tasks])
  const tomorrowSuggestion = useMemo(() => suggestTomorrowAction(execution, tasks), [execution, tasks])
  const [initial] = useState(() => loadDailyReview(date))
  const [win, setWin] = useState(initial?.win ?? '')
  const [learned, setLearned] = useState(initial?.learned ?? '')
  const [tomorrow, setTomorrow] = useState(initial?.tomorrow ?? '')
  const [complete, setComplete] = useState(() => isDailyReviewComplete(initial))
  const [message, setMessage] = useState('')
  const [expanded, setExpanded] = useState(() => initiallyExpanded && !isDailyReviewComplete(initial))

  const save = (finish: boolean) => {
    saveDailyReview(date, { win, learned, tomorrow, execution }, finish)
    if (finish) setComplete(true)
    setMessage(finish ? '오늘의 업무를 닫았습니다.' : '회고를 저장했습니다.')
  }

  return (
    <Card className="folio-surface gap-0 border-0 py-0">
      <details
        open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
        className="group"
      >
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-5 [&::-webkit-details-marker]:hidden sm:px-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Shutdown review</p>
            <CardTitle className="mt-1 flex items-center gap-2 text-lg"><ClipboardCheck className="size-4" />오늘 업무 닫기</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{execution.planned ? `Top 3 ${execution.completed}/${execution.planned} 완료 · 미완료 ${execution.open}` : '확정된 Top 3 없음'} · 오늘 기록 {journalCount}</p>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            {complete ? <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"><CheckCircle2 className="size-3" />완료</span> : <span className="hidden text-[11px] text-muted-foreground sm:inline">{expanded ? '접기' : '하루 정리하기'}</span>}
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <CardContent className="grid gap-3 border-t px-5 py-5 sm:px-6 lg:grid-cols-3">
          <ReviewField label="오늘 가장 잘한 일" value={win} onChange={setWin} placeholder="작더라도 분명한 진전 한 가지" />
          <ReviewField label="배운 점 또는 막힌 점" value={learned} onChange={setLearned} placeholder="다음에는 다르게 해볼 점" />
          <ReviewField label="내일의 첫 행동" value={tomorrow} onChange={setTomorrow} placeholder="업무를 시작하면 가장 먼저 할 일" suggestion={tomorrowSuggestion} />
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between lg:col-span-3">
            <p className="text-[11px] text-muted-foreground" role="status">{message || '완료하면 내일 Today에서 다시 이어갈 수 있습니다.'}</p>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button variant="outline" size="sm" className="h-11 gap-1.5 rounded-full sm:h-8" onClick={() => save(false)} disabled={!win.trim() && !learned.trim() && !tomorrow.trim()}><Save className="size-3.5" />저장</Button>
              <Button size="sm" className="h-11 gap-1.5 rounded-full sm:h-8" onClick={() => save(true)} disabled={!win.trim() && !learned.trim() && !tomorrow.trim()}><CheckCircle2 className="size-3.5" />업무 닫기</Button>
            </div>
          </div>
        </CardContent>
      </details>
    </Card>
  )
}

function ReviewField({ label, value, onChange, placeholder, suggestion }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; suggestion?: string | null }) {
  const id = useId()
  return <div className="space-y-1.5"><label htmlFor={id} className="block text-xs font-semibold">{label}</label><Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="min-h-24 resize-y bg-muted/35 text-sm" placeholder={placeholder} />{suggestion && !value.trim() ? <button type="button" onClick={() => onChange(suggestion)} aria-label={`내일 첫 행동으로 제안 적용: ${suggestion}`} className="flex max-w-full items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1.5 text-left text-[11px] font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:bg-sky-950/35 dark:text-sky-300 dark:hover:bg-sky-950/55"><Sparkles className="size-3 shrink-0" /><span className="truncate">제안 적용 · {suggestion}</span></button> : null}</div>
}
