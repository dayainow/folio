'use client'

/**
 * P50 — 성능 관측 대시보드 (Web Vitals · API · 렌더 · 기간 필터)
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Activity, Gauge, Loader2, RefreshCw, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  clearPerfMetrics,
  computePerfStats,
  listPerfMetrics,
  subscribePerfMetrics,
  WEB_VITAL_THRESHOLDS,
  type PerfMetricEntry,
  type PerfRange,
  type PerfStats,
  type WebVitalName,
} from '@/lib/perf-metrics'
import { computePerfHealthScore } from '@/lib/perf-score'
import { SpriteIcon } from '@/components/icon-sprite'
import { cn } from '@/lib/utils'

const Charts = dynamic(() => import('@/components/perf-observability-charts'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground">
      차트 로딩…
    </div>
  ),
})

function StatPill({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'ok' | 'warn' | 'neutral'
}) {
  const toneClass =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
        : 'border-gray-100 bg-muted/40 text-foreground dark:border-gray-800'
  return (
    <div className={cn('rounded-xl border px-3 py-2', toneClass)}>
      <p className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function formatVital(name: WebVitalName, value: number): string {
  if (name === 'CLS') return value.toFixed(3)
  return `${Math.round(value)}ms`
}

export function PerfObservabilityButton() {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 rounded-full border px-2.5 text-[11px] font-medium"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
      >
        <Gauge className="h-3.5 w-3.5 text-teal-600" />
        성능
      </Button>
      {open ? <PerfObservabilityPanel id={panelId} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export function PerfObservabilityPanel({
  id,
  onClose,
}: {
  id?: string
  onClose: () => void
}) {
  const [range, setRange] = useState<PerfRange>('24h')
  const [stats, setStats] = useState<PerfStats>(() => computePerfStats('24h'))
  const [recent, setRecent] = useState<PerfMetricEntry[]>(() => listPerfMetrics(30))
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    setStats(computePerfStats(range))
    setRecent(listPerfMetrics(30))
  }, [range])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) refresh()
    })
    return () => {
      cancelled = true
    }
  }, [refresh])

  useEffect(() => subscribePerfMetrics(() => refresh()), [refresh])

  const vitalRows = useMemo(() => {
    const names: WebVitalName[] = ['LCP', 'INP', 'CLS', 'TTFB', 'FCP']
    return names.map((name) => {
      const v = stats.webVitals[name]
      const thr = WEB_VITAL_THRESHOLDS[name]
      return { name, v, thr, label: name === 'INP' ? 'INP (FID↑)' : name }
    })
  }, [stats])

  const health = useMemo(() => computePerfHealthScore(stats), [stats])

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label="성능 관측"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <SpriteIcon name="perf-gauge" className="size-4 text-teal-600" />
          <div>
            <h2 className="text-sm font-semibold">성능 관측</h2>
            <p className="text-[11px] text-muted-foreground">Web Vitals · API · 렌더 · P66</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {(['24h', '7d', '30d'] as PerfRange[]).map((r) => (
              <Button
                key={r}
                type="button"
                size="sm"
                variant={range === r ? 'default' : 'ghost'}
                className="h-7 px-2 text-[11px]"
                onClick={() => setRange(r)}
              >
                {r}
              </Button>
            ))}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => {
                setBusy(true)
                refresh()
                setBusy(false)
              }}
              aria-label="새로고침"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            </Button>
            <Button type="button" size="icon" variant="ghost" className="size-8" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </header>

        <div className="space-y-4 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <StatPill
              label="종합 스코어"
              value={health.score === null ? '—' : `${health.score}`}
              tone={
                health.label === 'excellent' || health.label === 'good'
                  ? 'ok'
                  : health.label === 'fair' || health.label === 'poor'
                    ? 'warn'
                    : 'neutral'
              }
            />
            <StatPill
              label="LCP p75"
              value={
                stats.webVitals.LCP ? formatVital('LCP', stats.webVitals.LCP.p75) : '—'
              }
              tone={
                !stats.webVitals.LCP
                  ? 'neutral'
                  : stats.webVitals.LCP.p75 <= WEB_VITAL_THRESHOLDS.LCP.good
                    ? 'ok'
                    : 'warn'
              }
            />
            <StatPill
              label="API 평균"
              value={stats.api.count ? `${Math.round(stats.api.avgMs)}ms` : '—'}
            />
            <StatPill
              label="API 에러율"
              value={`${stats.api.errorRate}%`}
              tone={stats.api.errorRate > 5 ? 'warn' : 'ok'}
            />
            <StatPill
              label="느린 렌더"
              value={`${stats.render.slowCount}/${stats.render.count}`}
              tone={stats.render.slowCount > 0 ? 'warn' : 'ok'}
            />
          </div>

          <Charts stats={stats} />

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
              <Activity className="h-3.5 w-3.5" />
              Web Vitals
            </h3>
            <div className="space-y-1.5">
              {vitalRows.map(({ name, v, thr, label }) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-2.5 py-2 text-xs dark:border-gray-800"
                >
                  <span className="font-medium">{label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {v
                      ? `avg ${formatVital(name, v.avg)} · p75 ${formatVital(name, v.p75)} · n=${v.count}`
                      : `데이터 없음 (good≤${thr.good}${thr.unit === 'ms' ? 'ms' : ''})`}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold">페이지·API 지연</h3>
            {stats.api.byPath.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">아직 API 호출 기록이 없습니다.</p>
            ) : (
              <ul className="space-y-1">
                {stats.api.byPath.slice(0, 8).map((row) => (
                  <li
                    key={row.path}
                    className="flex justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-[11px] tabular-nums"
                  >
                    <span className="truncate font-mono">{row.path}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {row.avgMs}ms · {row.count}회
                      {row.errors ? ` · err ${row.errors}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold">렌더 (느린 컴포넌트)</h3>
            {stats.render.byComponent.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                PerfProfiler로 감싼 컴포넌트의 느린 렌더가 여기 표시됩니다.
              </p>
            ) : (
              <ul className="space-y-1">
                {stats.render.byComponent.slice(0, 8).map((row) => (
                  <li
                    key={row.name}
                    className="flex justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-[11px]"
                  >
                    <span className="truncate">{row.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      max {row.maxMs}ms · avg {row.avgMs}ms
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold">최근 이벤트</h3>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-[11px] text-destructive"
                onClick={() => {
                  clearPerfMetrics()
                  refresh()
                }}
              >
                <Trash2 className="h-3 w-3" />
                비우기
              </Button>
            </div>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px]">
              {recent.map((e) => (
                <li key={e.id} className="flex justify-between gap-2 border-b border-border/50 py-1">
                  <span className="truncate">
                    <span className="text-muted-foreground">{e.kind}</span> {e.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {e.unit === 'score' ? e.value.toFixed(3) : `${Math.round(e.value)}${e.unit === 'ms' ? 'ms' : ''}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
