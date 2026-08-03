'use client'

/**
 * P47 — 저장 관측 대시보드 (성공률 · 실패 원인 · 모드별 통계 · 시간 추이 · 무결성)
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Activity,
  AlertTriangle,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  clearAuditLogs,
  computeStorageObservabilityStats,
  listAuditLogs,
  loadAuditConfigFromRuntime,
  subscribeAuditLog,
  type AuditLogEntry,
  type StorageObservabilityStats,
} from '@/lib/audit-log'
import {
  formatIntegritySuggestions,
  verifyStorageIntegrity,
  type IntegrityReport,
} from '@/lib/storage-integrity'
import { STORAGE_MODE_LABELS, type StorageMode } from '@/lib/storage'
import { cn } from '@/lib/utils'

const Charts = dynamic(() => import('@/components/storage-observability-charts'), {
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

function ModeRow({
  mode,
  stats,
}: {
  mode: StorageMode
  stats: StorageObservabilityStats['byMode'][StorageMode]
}) {
  const rate = stats.total === 0 ? 100 : Math.round((stats.success / stats.total) * 1000) / 10
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-2.5 py-2 text-xs dark:border-gray-800">
      <span className="font-medium">{STORAGE_MODE_LABELS[mode]}</span>
      <span className="text-muted-foreground tabular-nums">
        {stats.total}회 · 성공 {rate}% · 평균 {stats.avgDurationMs}ms
      </span>
    </div>
  )
}

export function StorageObservabilityButton() {
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
        <HardDrive className="h-3 w-3 opacity-70" aria-hidden />
        <span className="hidden sm:inline">저장 관측</span>
      </Button>
      {open ? <StorageObservabilityPanel panelId={panelId} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export function StorageObservabilityPanel({
  panelId,
  onClose,
}: {
  panelId?: string
  onClose?: () => void
}) {
  const [stats, setStats] = useState<StorageObservabilityStats | null>(null)
  const [recent, setRecent] = useState<AuditLogEntry[]>([])
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null)
  const [integrityLoading, setIntegrityLoading] = useState(false)
  const [busy, setBusy] = useState(true)

  const refresh = useCallback(() => {
    setBusy(true)
    try {
      setStats(computeStorageObservabilityStats())
      setRecent(listAuditLogs().slice(-12).reverse())
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void loadAuditConfigFromRuntime().finally(() => refresh())
    return subscribeAuditLog(() => refresh())
  }, [refresh])

  const runIntegrity = useCallback(async () => {
    setIntegrityLoading(true)
    try {
      const report = await verifyStorageIntegrity()
      setIntegrity(report)
    } catch {
      setIntegrity(null)
    } finally {
      setIntegrityLoading(false)
    }
  }, [])

  const suggestions = useMemo(
    () => (integrity ? formatIntegritySuggestions(integrity) : []),
    [integrity],
  )

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <Card
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label="저장 관측 대시보드"
        className="flex max-h-[min(92vh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-100 shadow-xl dark:border-gray-800"
      >
        <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Activity className="h-4 w-4" aria-hidden />
              저장 관측
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              감사 로그 · 모드별 성공률 · 무결성 (보존 {stats?.retentionDays ?? 30}일 · 알림 임계{' '}
              {stats?.alertThreshold ?? 3}회)
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label="새로고침"
              onClick={() => refresh()}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />
            </Button>
            {onClose ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label="닫기"
                onClick={onClose}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-3">
          {stats ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatPill
                label="성공률"
                value={`${stats.successRate}%`}
                tone={stats.successRate >= 95 ? 'ok' : stats.successRate >= 80 ? 'neutral' : 'warn'}
              />
              <StatPill label="평균 응답" value={`${stats.avgDurationMs}ms`} />
              <StatPill
                label="실패/폴백"
                value={`${stats.failure}`}
                tone={stats.failure > 0 ? 'warn' : 'ok'}
              />
              <StatPill
                label="연속 실패"
                value={`${stats.consecutiveFailures}`}
                tone={
                  stats.consecutiveFailures >= stats.alertThreshold
                    ? 'warn'
                    : stats.consecutiveFailures > 0
                      ? 'neutral'
                      : 'ok'
                }
              />
            </div>
          ) : (
            <div className="flex h-16 items-center justify-center text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> 집계 중…
            </div>
          )}

          {stats && stats.hourly.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">시간별 저장 추이</h3>
              <Charts hourly={stats.hourly} byMode={stats.byMode} reasons={stats.failureReasons} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">아직 저장 이벤트가 없습니다. 일지·문서를 저장하면 여기에 표시됩니다.</p>
          )}

          {stats ? (
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold text-muted-foreground">모드별 사용량</h3>
              {(['local', 'cloud', 'beacon'] as StorageMode[]).map((m) => (
                <ModeRow key={m} mode={m} stats={stats.byMode[m]} />
              ))}
            </div>
          ) : null}

          {stats && stats.failureReasons.length > 0 ? (
            <div>
              <h3 className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                실패 원인
              </h3>
              <ul className="space-y-1">
                {stats.failureReasons.map((r) => (
                  <li
                    key={r.reason}
                    className="flex justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="truncate">{r.reason}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{r.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                데이터 무결성
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                disabled={integrityLoading}
                onClick={() => void runIntegrity()}
              >
                {integrityLoading ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : null}
                검사 실행
              </Button>
            </div>
            {integrity ? (
              <div
                className={cn(
                  'rounded-xl border px-3 py-2 text-[11px]',
                  integrity.ok
                    ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30'
                    : 'border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30',
                )}
              >
                <p className="font-medium">
                  {integrity.ok ? '일치 또는 비교 대상 부족' : `불일치 ${integrity.mismatches.length}건`}
                </p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted-foreground">
                  {suggestions.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                localStorage · Supabase 캐시 · Beacon checksum을 비교합니다.
              </p>
            )}
          </div>

          {recent.length > 0 ? (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">최근 이벤트</h3>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {recent.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-lg border border-gray-100 px-2.5 py-1.5 text-[11px] dark:border-gray-800"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{e.change}</span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-0.5 text-[10px]',
                          e.status === 'success'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : e.status === 'fallback'
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
                              : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
                        )}
                      >
                        {e.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">
                      {new Date(e.ts).toLocaleString('ko-KR')} · {e.user} · {e.mode}
                      {typeof e.durationMs === 'number' ? ` · ${e.durationMs}ms` : ''}
                      {typeof e.size === 'number' ? ` · ${e.size}B` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5 dark:border-gray-800">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-[11px] text-muted-foreground"
            onClick={() => {
              clearAuditLogs()
              refresh()
              setIntegrity(null)
            }}
          >
            <Trash2 className="h-3 w-3" aria-hidden />
            로그 비우기
          </Button>
          <Button type="button" size="sm" className="h-8 text-[11px]" onClick={onClose}>
            닫기
          </Button>
        </div>
      </Card>
    </div>
  )
}
