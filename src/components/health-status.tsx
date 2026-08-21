'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Activity, CloudOff, Database, HardDrive, Loader2, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useEscapeToClose, useFocusTrap } from '@/lib/a11y'
import {
  overallHealth,
  requestHealthRefresh,
  runToastRetry,
  subscribeAppToast,
  subscribeHealthRefresh,
  type AppToastDetail,
  type HealthLevel,
  type OverallHealth,
} from '@/lib/health-monitor'
import { subscribeStorageMode } from '@/lib/storage'
import { cn } from '@/lib/utils'

const POLL_MS = 30_000

function badgeStyles(level: HealthLevel) {
  if (level === 'ok') {
    return {
      className:
        'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
      dot: 'bg-emerald-500',
    }
  }
  if (level === 'cloud-disconnected') {
    return {
      className:
        'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
      dot: 'bg-amber-500',
    }
  }
  return {
    className:
      'border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300',
    dot: 'bg-gray-400',
  }
}

function StatusRow({
  icon,
  title,
  ok,
  detail,
}: {
  icon: ReactNode
  title: string
  ok: boolean | null
  detail: string
}) {
  const tone =
    ok === true
      ? 'text-emerald-600 dark:text-emerald-400'
      : ok === false
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-muted-foreground'
  return (
    <div className="flex gap-3 rounded-xl border border-gray-100 px-3 py-2.5 dark:border-gray-800">
      <div className={cn('mt-0.5', tone)} aria-hidden>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground">{title}</span>
          <span className={cn('text-[10px] font-medium', tone)}>
            {ok === true ? '정상' : ok === false ? '이상' : '—'}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground break-all">{detail}</p>
      </div>
    </div>
  )
}

export function HealthStatus() {
  const [health, setHealth] = useState<OverallHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<AppToastDetail | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const close = useCallback(() => setOpen(false), [])

  useEscapeToClose(open, close)
  useFocusTrap(open, rootRef)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await overallHealth()
      setHealth(next)
    } catch {
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const boot = window.setTimeout(() => {
      void refresh()
    }, 0)
    const id = window.setInterval(() => void refresh(), POLL_MS)
    const unsubHealth = subscribeHealthRefresh(() => void refresh())
    const unsubMode = subscribeStorageMode(() => void refresh())
    return () => {
      window.clearTimeout(boot)
      window.clearInterval(id)
      unsubHealth()
      unsubMode()
    }
  }, [refresh])

  useEffect(() => {
    return subscribeAppToast((detail) => {
      setToast(detail)
      if (toastTimer.current) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToast(null), 8000)
    })
  }, [])

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (!open) return
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  const level: HealthLevel = health?.level ?? 'ok'
  const styles = badgeStyles(level)
  const label = health?.badgeLabel ?? (loading ? '점검 중' : '상태 미확인')

  const localOk = health?.storage.localOk ?? null
  const cloudOk =
    health == null
      ? null
      : health.supabase.configured
        ? health.supabase.connected &&
          (health.storage.mode !== 'cloud' || health.supabase.authenticated)
        : null
  const beaconOk = health?.storage.beaconRelevant
    ? (health.beacon.available ?? null)
    : null

  return (
    <>
      <div className="relative" ref={rootRef}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-7 gap-1.5 rounded-full border px-2.5 text-[11px] font-medium',
            styles.className,
          )}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`시스템 상태: ${label}. 상세 보기`}
          onClick={() => setOpen((v) => !v)}
        >
          {loading && !health ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} aria-hidden />
          )}
          <Activity className="h-3 w-3 opacity-70" aria-hidden />
          <span className="hidden sm:inline min-w-[3.5rem] text-left">{label}</span>
        </Button>

        {open && (
          <Card
            id={panelId}
            role="dialog"
            aria-label="시스템 상태 상세"
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(100vw-2rem,22rem)] rounded-2xl border border-gray-100 p-3 shadow-lg dark:border-gray-800"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">시스템 상태</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {health?.summary ?? '상태를 불러오는 중…'}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                aria-label="닫기"
                onClick={close}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="mb-3 rounded-xl bg-muted/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', styles.dot)} aria-hidden />
                <span className="text-xs font-medium">{label}</span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                저장 모드 · {health?.storage.label ?? '—'}
                {health?.checkedAt
                  ? ` · ${new Date(health.checkedAt).toLocaleTimeString('ko-KR')}`
                  : ''}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <StatusRow
                icon={<HardDrive className="h-3.5 w-3.5" />}
                title="로컬 저장"
                ok={localOk}
                detail={health?.storage.message ?? '—'}
              />
              <StatusRow
                icon={<CloudOff className="h-3.5 w-3.5" />}
                title="Supabase"
                ok={cloudOk}
                detail={health?.supabase.message ?? '—'}
              />
              <StatusRow
                icon={<Database className="h-3.5 w-3.5" />}
                title="Beacon"
                ok={beaconOk}
                detail={
                  health?.storage.beaconRelevant
                    ? (health.beacon.message ?? '—')
                    : health?.beacon.available
                      ? '선택 확장 · 연결됨'
                      : '선택 확장 · 연결하지 않아도 사용할 수 있습니다'
                }
              />
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 flex-1 gap-1.5 text-xs"
                disabled={loading}
                onClick={() => void refresh()}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                다시 점검
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 flex-1 text-xs"
                onClick={() => {
                  requestHealthRefresh()
                  void refresh()
                }}
              >
                재연결 시도
              </Button>
            </div>
          </Card>
        )}
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[60] flex max-w-sm items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg dark:border-amber-900 dark:bg-amber-950/90 dark:text-amber-100"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">저장 알림</p>
            <p className="mt-0.5 text-[12px] leading-snug opacity-90">{toast.message}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {toast.withRetry && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-amber-300 text-[11px] dark:border-amber-800"
                onClick={() => {
                  runToastRetry()
                  setToast(null)
                }}
              >
                재시도
              </Button>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              aria-label="닫기"
              onClick={() => setToast(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
