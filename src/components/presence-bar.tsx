'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getOrCreateGuestId,
  joinPresenceRoom,
  presenceColorFor,
  type PresenceUser,
} from '@/lib/presence'
import { cn } from '@/lib/utils'

export type PresenceBarProps = {
  roomId: string
  tab?: string
  className?: string
  user?: { id: string; name: string; email?: string | null } | null
}

export function PresenceBar({ roomId, tab, className, user }: PresenceBarProps) {
  const [peers, setPeers] = useState<PresenceUser[]>([])
  const [typingPeers, setTypingPeers] = useState<PresenceUser[]>([])
  const [transport, setTransport] = useState('—')

  const self = useMemo(() => {
    const userId = user?.id ?? getOrCreateGuestId()
    const name = user?.name || user?.email?.split('@')[0] || '나'
    return {
      userId,
      name,
      email: user?.email ?? null,
      color: presenceColorFor(userId),
      tab,
    }
  }, [user?.id, user?.name, user?.email, tab])

  useEffect(() => {
    let alive = true
    const session = joinPresenceRoom({
      roomId,
      self,
      onPeers: (next) => {
        if (alive) setPeers(next)
      },
    })
    // P43 — 에디터 선택 룸에서 타이핑 상태 수집
    const sel = joinPresenceRoom({
      roomId: `sel:${roomId}`,
      self,
      onPeers: (next) => {
        if (alive) setTypingPeers(next.filter((p) => p.typing))
      },
    })
    queueMicrotask(() => {
      if (alive) setTransport(session.transport)
    })
    return () => {
      alive = false
      session.leave()
      sel.leave()
    }
  }, [roomId, self])

  const shown = peers.slice(0, 5)
  const extra = Math.max(0, peers.length - shown.length)

  return (
    <div
      className={cn('flex items-center gap-2 text-[11px] text-muted-foreground', className)}
      aria-label="현재 편집 중인 사용자"
      title={`동기화: ${transport}`}
    >
      <span className="shrink-0">접속</span>
      <div className="flex -space-x-1.5">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white"
          style={{ backgroundColor: self.color }}
          title={`${self.name} (나)`}
        >
          {self.name.slice(0, 1).toUpperCase()}
        </span>
        {shown.map((p) => (
          <span
            key={p.userId}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white"
            style={{ backgroundColor: p.color }}
            title={p.name}
          >
            {p.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
        {extra > 0 && (
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-background bg-muted px-1 text-[10px] font-medium text-foreground">
            +{extra}
          </span>
        )}
      </div>
      {peers.length === 0 && <span className="text-[10px] opacity-70">혼자 편집 중</span>}
      {typingPeers.length > 0 && (
        <span className="flex items-center gap-1 text-[10px] text-foreground" aria-live="polite">
          <span className="inline-flex gap-0.5" aria-hidden>
            <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
          </span>
          {typingPeers.map((p) => p.name).join(', ')} 입력 중
        </span>
      )}
    </div>
  )
}
