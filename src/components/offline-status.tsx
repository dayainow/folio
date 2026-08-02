'use client'

/**
 * P44 — 오프라인 / 동기화 상태 표시기 (업로드·완료·실패)
 */
import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw, Check, AlertTriangle, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  subscribeOnlineStatus,
  syncWhenOnline,
  type SyncPhase,
} from '@/lib/offline-sync'
import { cn } from '@/lib/utils'

/** 헤더 — 오프라인 / 동기화 대기 · 단계 뱃지 */
export function OfflineStatusBadge() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [phase, setPhase] = useState<SyncPhase>('idle')
  const [lastError, setLastError] = useState<string | null>(null)

  useEffect(() => {
    return subscribeOnlineStatus((detail) => {
      setOnline(detail.online)
      setPending(detail.pending)
      setPhase(detail.phase)
      setLastError(detail.lastError ?? null)
    })
  }, [])

  const uploading = phase === 'uploading'
  const failed = phase === 'failed'
  const done = phase === 'done'
  const show = !online || pending > 0 || uploading || failed || done
  if (!show) return null

  const label = !online
    ? '오프라인'
    : uploading
      ? '업로드 중'
      : failed
        ? '동기화 실패'
        : done
          ? '동기화 완료'
          : `대기 ${pending}`

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'h-9 min-h-[48px] gap-1.5 rounded-full border px-3 text-[11px] font-medium md:h-7 md:min-h-0 md:px-2.5',
        !online || failed
          ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100'
          : done
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100'
            : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-100',
      )}
      aria-label={label}
      title={
        lastError ||
        (!online
          ? '오프라인 — 변경은 로컬·IndexedDB에 저장됩니다'
          : uploading
            ? '서버로 업로드 중…'
            : done
              ? '동기화 완료'
              : `대기 ${pending}건 · 클릭하여 동기화`)
      }
      disabled={uploading || !online}
      onClick={() => {
        if (!online || uploading) return
        void syncWhenOnline()
      }}
    >
      {!online ? (
        <WifiOff className="h-3.5 w-3.5" aria-hidden />
      ) : uploading ? (
        <Upload className="h-3.5 w-3.5 animate-pulse" aria-hidden />
      ) : failed ? (
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      ) : done ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
      )}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  )
}
