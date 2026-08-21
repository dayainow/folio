'use client'

import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { analyzeTimeline, type TimelineAnalytics } from '@/lib/beacon-automation'
import type { TimelineItem } from '@/lib/beacon'
import { cn } from '@/lib/utils'

function Heatmap({ analytics }: { analytics: TimelineAnalytics }) {
  const max = Math.max(1, ...analytics.byDay.map((d) => d.count))
  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
    >
      {analytics.byDay.map((d) => {
        const intensity = d.count === 0 ? 0 : 0.2 + (d.count / max) * 0.8
        return (
          <div
            key={d.date}
            title={`${d.date}: ${d.count}건`}
            className={cn(
              'aspect-square rounded-sm border border-gray-100 dark:border-gray-800',
              d.count === 0 && 'bg-gray-50 dark:bg-gray-900/40',
            )}
            style={
              d.count > 0
                ? { backgroundColor: `color-mix(in oklab, var(--foreground) ${Math.round(intensity * 55)}%, transparent)` }
                : undefined
            }
          />
        )
      })}
    </div>
  )
}

export function BeaconTimelineAnalytics({
  events,
  includeBeacon = true,
}: {
  events: TimelineItem[]
  includeBeacon?: boolean
}) {
  const analytics = useMemo(() => analyzeTimeline(events, 28), [events])

  return (
    <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 p-5 bg-card shadow-sm">
      <h3 className="text-sm font-semibold tracking-tight">Timeline 분석</h3>
      <p className="mt-0.5 text-[11px] text-muted-foreground mb-4">
        최근 28일 활동 · {includeBeacon ? 'Beacon + Folio 이벤트' : 'Folio 업무 흐름'}
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-gray-100 px-3 py-2 dark:border-gray-800">
          <div className="text-[10px] text-muted-foreground">이번 주</div>
          <div className="text-lg font-semibold tabular-nums">{analytics.weekCount}</div>
        </div>
        <div className="rounded-xl border border-gray-100 px-3 py-2 dark:border-gray-800">
          <div className="text-[10px] text-muted-foreground">이번 달</div>
          <div className="text-lg font-semibold tabular-nums">{analytics.monthCount}</div>
        </div>
      </div>

      <div className="mb-1 text-[11px] font-medium text-muted-foreground">활동 히트맵</div>
      <Heatmap analytics={analytics} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-[11px] font-medium text-muted-foreground mb-1">소스별</div>
          <ul className="space-y-1">
            {analytics.bySource.length === 0 ? (
              <li className="text-[11px] text-muted-foreground">데이터 없음</li>
            ) : (
              analytics.bySource.slice(0, 5).map((row) => (
                <li key={row.source} className="flex justify-between text-[11px]">
                  <span className="truncate">{row.source}</span>
                  <span className="tabular-nums text-muted-foreground">{row.count}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-medium text-muted-foreground mb-1">카테고리별</div>
          <ul className="space-y-1">
            {analytics.byCategory.length === 0 ? (
              <li className="text-[11px] text-muted-foreground">데이터 없음</li>
            ) : (
              analytics.byCategory.slice(0, 5).map((row) => (
                <li key={row.category} className="flex justify-between text-[11px]">
                  <span className="truncate">{row.category}</span>
                  <span className="tabular-nums text-muted-foreground">{row.count}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </Card>
  )
}
