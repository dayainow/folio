'use client'

/**
 * P41 — 접속 중 사용자 아바타
 */
import { cn } from '@/lib/utils'
import type { PresenceUser } from '@/lib/presence'

export function PresenceAvatars({
  peers,
  className,
  max = 5,
}: {
  peers: PresenceUser[]
  className?: string
  max?: number
}) {
  if (peers.length === 0) return null
  const shown = peers.slice(0, max)
  const extra = peers.length - shown.length

  return (
    <div
      className={cn('flex items-center -space-x-1.5', className)}
      aria-label={`함께 편집 중 ${peers.length}명`}
      title={peers.map((p) => p.name).join(', ')}
    >
      {shown.map((p) => (
        <span
          key={p.userId}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white shadow-sm"
          style={{ backgroundColor: p.color }}
          title={`${p.name}${p.cursor ? ' · 커서 공유' : ''}`}
        >
          {(p.name || '?').slice(0, 1).toUpperCase()}
        </span>
      ))}
      {extra > 0 ? (
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-background bg-muted px-1 text-[10px] font-medium text-muted-foreground">
          +{extra}
        </span>
      ) : null}
    </div>
  )
}
