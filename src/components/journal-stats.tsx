'use client'

/**
 * P58 — 일지 통계 (빈도 · 태그 · 시간대 히트맵 · streak)
 */
import { useEffect, useMemo, useState, memo } from 'react'
import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  computeJournalAnalytics,
  type AnalyticsRange,
  type JournalAnalytics,
} from '@/lib/analytics'
import { loadJournalsWithFallback, type JournalEntry } from '@/lib/journal'
import { computeHourHeatmap, computeWritingStreak } from '@/lib/calendar-engine'

const JournalCharts = dynamic(
  () => import('@/components/analytics-charts').then((m) => ({ default: m.JournalCharts })),
  {
    ssr: false,
    loading: () => <p className="py-8 text-center text-xs text-muted-foreground">차트 로딩…</p>,
  },
)

const RANGES: Array<{ key: AnalyticsRange; label: string }> = [
  { key: '1w', label: '1주' },
  { key: '1m', label: '1개월' },
  { key: '3m', label: '3개월' },
  { key: 'all', label: '전체' },
]

export const JournalStatsPanel = memo(function JournalStatsPanel({
  journals: journalsProp,
  className,
}: {
  journals?: Record<string, JournalEntry>
  className?: string
}) {
  const [range, setRange] = useState<AnalyticsRange>('1m')
  const [journals, setJournals] = useState<Record<string, JournalEntry>>(journalsProp ?? {})
  const [data, setData] = useState<JournalAnalytics | null>(null)

  useEffect(() => {
    if (journalsProp) {
      setJournals(journalsProp)
      return
    }
    let cancelled = false
    void loadJournalsWithFallback().then((j) => {
      if (!cancelled) setJournals(j)
    })
    return () => {
      cancelled = true
    }
  }, [journalsProp])

  useEffect(() => {
    setData(computeJournalAnalytics(journals, range))
  }, [journals, range])

  const streak = useMemo(() => computeWritingStreak(journals), [journals])
  const hours = useMemo(() => computeHourHeatmap(journals), [journals])
  const maxHour = Math.max(1, ...hours.map((h) => h.count))

  const lineData = useMemo(() => {
    if (!data) return []
    if (range === '1w' || range === '1m') {
      return data.daily.map((d) => ({ label: d.date.slice(5), count: d.count }))
    }
    if (range === '3m') {
      return data.weekly.map((w) => ({ label: w.week, count: w.count }))
    }
    return data.monthly.map((m) => ({ label: m.month, count: m.count }))
  }, [data, range])

  const pieData = useMemo(
    () => (data?.tags ?? []).slice(0, 8).map((t) => ({ name: t.tag, value: t.count })),
    [data],
  )

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">일지 통계</h3>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <Button
              key={r.key}
              type="button"
              size="sm"
              variant={range === r.key ? 'default' : 'outline'}
              className="h-7 text-[11px]"
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="작성 수" value={String(data?.totalEntries ?? 0)} />
        <StatCard label="단어 수" value={String(data?.totalWords ?? 0)} />
        <StatCard label="연속 작성" value={`${streak.current}일`} hint={`최장 ${streak.longest}일`} />
        <StatCard
          label="주간 평균"
          value={
            data?.weekly.length
              ? (data.weekly.reduce((s, w) => s + w.count, 0) / data.weekly.length).toFixed(1)
              : '0'
          }
        />
      </div>

      {data && (
        <JournalCharts
          lineData={lineData}
          pieData={pieData}
          rangeLabel={
            range === '1w' || range === '1m' ? '일별 작성 추이' : '주간/월간 작성 추이'
          }
        />
      )}

      <Card className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
        <h4 className="mb-2 text-xs font-semibold">작성 시간대 히트맵</h4>
        <div className="flex gap-0.5 overflow-x-auto pb-1">
          {hours.map((h) => (
            <div key={h.hour} className="flex w-5 shrink-0 flex-col items-center gap-0.5 sm:w-6">
              <div
                className="h-10 w-full rounded-sm"
                style={{
                  backgroundColor: `rgba(59, 130, 246, ${0.12 + (0.88 * h.count) / maxHour})`,
                }}
                title={`${h.hour}시 · ${h.count}건`}
              />
              <span className="text-[8px] tabular-nums text-muted-foreground">{h.hour}</span>
            </div>
          ))}
        </div>
      </Card>

      {data && data.tags.length > 0 && (
        <Card className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
          <h4 className="mb-2 text-xs font-semibold">태그별 사용 빈도</h4>
          <ul className="space-y-1">
            {data.tags.slice(0, 12).map((t) => {
              const max = data.tags[0]?.count || 1
              return (
                <li key={t.tag} className="flex items-center gap-2 text-[11px]">
                  <span className="w-20 truncate text-muted-foreground">#{t.tag}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${(100 * t.count) / max}%` }}
                    />
                  </div>
                  <span className="w-6 text-right tabular-nums">{t.count}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
})

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </Card>
  )
}
