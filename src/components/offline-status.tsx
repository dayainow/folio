'use client'

import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { subscribeOnlineStatus, syncWhenOnline } from '@/lib/offline-sync'
import { cn } from '@/lib/utils'

/** 헤더 — 오프라인 / 동기화 대기 뱃지 */
export function OfflineStatusBadge() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    return subscribeOnlineStatus((detail) => {
      setOnline(detail.online)
      setPending(detail.pending)
    })
  }, [])

  if (online && pending === 0) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'h-7 gap-1.5 rounded-full border px-2.5 text-[11px] font-medium',
        !online
          ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100'
          : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-100',
      )}
      aria-label={!online ? '오프라인' : `동기화 대기 ${pending}건`}
      title={!online ? '오프라인 — 변경은 로컬·IndexedDB에 저장됩니다' : `대기 ${pending}건 · 클릭하여 동기화`}
      disabled={syncing}
      onClick={() => {
        if (!online) return
        setSyncing(true)
        void syncWhenOnline().finally(() => setSyncing(false))
      }}
    >
      {!online ? (
        <WifiOff className="h-3 w-3" aria-hidden />
      ) : (
        <RefreshCw className={cn('h-3 w-3', syncing && 'animate-spin')} aria-hidden />
      )}
      <span className="hidden sm:inline">{!online ? '오프라인' : `동기화 ${pending}`}</span>
    </Button>
  )
}
