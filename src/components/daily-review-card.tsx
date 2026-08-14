'use client'

import { useState } from 'react'
import { CheckCircle2, ClipboardCheck, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { isDailyReviewComplete, loadDailyReview, saveDailyReview } from '@/lib/daily-review'

export function DailyReviewCard({
  date,
  completedTasks,
  journalCount,
}: {
  date: string
  completedTasks: number
  journalCount: number
}) {
  const [initial] = useState(() => loadDailyReview(date))
  const [win, setWin] = useState(initial?.win ?? '')
  const [learned, setLearned] = useState(initial?.learned ?? '')
  const [tomorrow, setTomorrow] = useState(initial?.tomorrow ?? '')
  const [complete, setComplete] = useState(() => isDailyReviewComplete(initial))
  const [message, setMessage] = useState('')

  const save = (finish: boolean) => {
    saveDailyReview(date, { win, learned, tomorrow }, finish)
    if (finish) setComplete(true)
    setMessage(finish ? '오늘의 업무를 닫았습니다.' : '회고를 저장했습니다.')
  }

  return (
    <Card className="folio-surface gap-4 border-0 py-6">
      <CardHeader className="flex-row items-start justify-between px-5 sm:px-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Shutdown review</p>
          <CardTitle className="mt-1 flex items-center gap-2 text-lg"><ClipboardCheck className="size-4" />오늘 업무 닫기</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">완료한 일 {completedTasks} · 오늘 기록 {journalCount}</p>
        </div>
        {complete ? <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"><CheckCircle2 className="size-3" />완료</span> : null}
      </CardHeader>
      <CardContent className="grid gap-3 px-5 sm:px-6 lg:grid-cols-3">
        <ReviewField label="오늘 가장 잘한 일" value={win} onChange={setWin} placeholder="작더라도 분명한 진전 한 가지" />
        <ReviewField label="배운 점 또는 막힌 점" value={learned} onChange={setLearned} placeholder="다음에는 다르게 해볼 점" />
        <ReviewField label="내일의 첫 행동" value={tomorrow} onChange={setTomorrow} placeholder="업무를 시작하면 가장 먼저 할 일" />
        <div className="flex items-center justify-between gap-3 lg:col-span-3">
          <p className="text-[11px] text-muted-foreground" role="status">{message || '완료하면 내일 Today에서 다시 이어갈 수 있습니다.'}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => save(false)} disabled={!win.trim() && !learned.trim() && !tomorrow.trim()}><Save className="size-3.5" />저장</Button>
            <Button size="sm" className="gap-1.5 rounded-full" onClick={() => save(true)} disabled={!win.trim() && !learned.trim() && !tomorrow.trim()}><CheckCircle2 className="size-3.5" />업무 닫기</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ReviewField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="space-y-1.5"><span className="text-xs font-semibold">{label}</span><Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="min-h-24 resize-y bg-muted/35 text-sm" placeholder={placeholder} /></label>
}
