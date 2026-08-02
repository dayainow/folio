'use client'

/**
 * P41/P45 — 접속 중 사용자 아바타 + 상태 점
 */
import { cn } from '@/lib/utils'
import type { PresenceStatus, PresenceUser } from '@/lib/presence'

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: '#22c55e',
  away: '#eab308',
  busy: '#ef4444',
}

export function PresenceAvatars({
  peers,
  className,
  max = 5,
  selfStatus,
}: {
  peers: PresenceUser[]
  className?: string
  max?: number
  selfStatus?: PresenceStatus
}) {
  if (peers.length === 0 && !selfStatus) return null
  const shown = peers.slice(0, max)
  const extra = peers.length - shown.length
  const typingPeers = peers.filter((p) => p.typing)

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      aria-label={`함께 편집 중 ${peers.length}명`}
      title={peers.map((p) => `${p.name}${p.typing ? ' (입력 중)' : ''}`).join(', ')}
    >
      <div className="flex items-center -space-x-1.5">
        {selfStatus ? (
          <span
            className="relative inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-foreground/80 text-[10px] font-semibold text-background shadow-sm"
            title={`나 · ${selfStatus}`}
          >
            나
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background"
              style={{ backgroundColor: STATUS_COLOR[selfStatus] }}
              aria-hidden
            />
          </span>
        ) : null}
        {shown.map((p) => (
          <span
            key={p.userId}
            className="relative inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white shadow-sm"
            style={{ backgroundColor: p.color }}
            title={`${p.name}${p.cursor ? ' · 커서' : ''}${p.typing ? ' · 입력 중' : ''} · ${p.status ?? 'online'}`}
          >
            {(p.name || '?').slice(0, 1).toUpperCase()}
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background"
              style={{ backgroundColor: STATUS_COLOR[p.status ?? 'online'] }}
              aria-hidden
            />
          </span>
        ))}
        {extra > 0 ? (
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-background bg-muted px-1 text-[10px] font-medium text-muted-foreground">
            +{extra}
          </span>
        ) : null}
      </div>
      {typingPeers.length > 0 ? (
        <span className="truncate text-[10px] text-muted-foreground">
          {typingPeers.map((p) => p.name).join(', ')} 입력 중…
        </span>
      ) : null}
    </div>
  )
}
