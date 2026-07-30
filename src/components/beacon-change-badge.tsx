'use client'

import { useEffect, useState } from 'react'
import { GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { subscribeBeaconChange, type BeaconChangeDetail } from '@/lib/beacon-automation'
import { cn } from '@/lib/utils'

/** 헤더 — Beacon 파일 변경 알림 뱃지 */
export function BeaconChangeBadge() {
  const [detail, setDetail] = useState<BeaconChangeDetail | null>(null)

  useEffect(() => {
    return subscribeBeaconChange((next) => {
      setDetail(next)
      window.setTimeout(() => setDetail(null), 8000)
    })
  }, [])

  if (!detail) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'h-7 gap-1.5 rounded-full border px-2.5 text-[11px] font-medium',
        'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200',
      )}
      aria-label={`Beacon 변경: ${detail.message}`}
      title={detail.message}
      onClick={() => setDetail(null)}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden />
      <GitBranch className="h-3 w-3 opacity-70" aria-hidden />
      <span className="hidden sm:inline">Beacon 변경</span>
    </Button>
  )
}
