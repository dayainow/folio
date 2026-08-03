'use client'

/**
 * P41/P45/P48 — 협업 패널 (Presence · 상태 · 주석 · 활동 · 채팅 · 화이트보드)
 */
import { useEffect, useState } from 'react'
import { Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PresenceAvatars } from '@/components/presence-avatars'
import { CommentThread } from '@/components/comment-thread'
import { ActivityFeed } from '@/components/activity-feed'
import { NotificationCenterButton } from '@/components/notification-center'
import { CollabChatPanel } from '@/components/collab-chat'
import { CollabWhiteboard } from '@/components/collab-whiteboard'
import { CollabModeToggle } from '@/components/collab-mode-toggle'
import { usePresence } from '@/hooks/use-collab'
import { useEscapeToClose } from '@/lib/a11y'
import { cn } from '@/lib/utils'
import type { PresenceStatus } from '@/lib/presence'

export type CollabPanelProps = {
  open: boolean
  onClose: () => void
  roomId: string | null
  target: { kind: 'doc' | 'journal'; id: string } | null
  tabLabel?: string
}

export function CollabPanel({ open, onClose, roomId, target, tabLabel }: CollabPanelProps) {
  const { peers, self, transport, updatePresence } = usePresence(open ? roomId : null, tabLabel)
  const [section, setSection] = useState<'comments' | 'activity' | 'alerts' | 'chat' | 'board'>('comments')
  const [status, setStatus] = useState<PresenceStatus>('online')

  useEscapeToClose(open, onClose)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open || !roomId) return
    updatePresence({ status })
  }, [open, roomId, status, updatePresence])

  useEffect(() => {
    if (!open) return
    let idleTimer: number | null = null
    const bump = () => {
      if (idleTimer) window.clearTimeout(idleTimer)
      setStatus((s) => {
        if (s === 'busy') return s
        return s === 'away' ? 'online' : s
      })
      idleTimer = window.setTimeout(() => {
        setStatus((s) => (s === 'busy' ? s : 'away'))
      }, 5 * 60_000)
    }
    const evs = ['pointerdown', 'keydown'] as const
    for (const e of evs) window.addEventListener(e, bump, { passive: true })
    idleTimer = window.setTimeout(() => {
      setStatus((s) => (s === 'busy' ? s : 'away'))
    }, 5 * 60_000)
    return () => {
      if (idleTimer) window.clearTimeout(idleTimer)
      for (const e of evs) window.removeEventListener(e, bump)
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="실시간 협업">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-background shadow-xl">
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Users className="size-4 shrink-0 text-teal-600" />
              <h2 className="truncate text-sm font-semibold">실시간 협업</h2>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {roomId ?? '룸 없음'}
              {transport ? ` · ${transport}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <CollabModeToggle />
            <NotificationCenterButton />
            <Button type="button" size="icon" variant="ghost" className="size-8" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </header>

        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <PresenceAvatars peers={peers} selfStatus={status} />
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="presence-status">
              내 상태
            </label>
            <select
              id="presence-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as PresenceStatus)}
              className="h-7 rounded-md border border-input bg-background px-1.5 text-[10px]"
            >
              <option value="online">online</option>
              <option value="away">away</option>
              <option value="busy">busy</option>
            </select>
            <span className="text-[11px] text-muted-foreground">
              {self ? `${self.name}` : '…'}
              {peers.length > 0 ? ` · +${peers.length}` : ' · 혼자'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
          {(
            [
              ['comments', '주석'],
              ['chat', '채팅'],
              ['board', '보드'],
              ['activity', '활동'],
              ['alerts', '알림'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs',
                section === id ? 'bg-foreground/5 font-medium' : 'text-muted-foreground hover:bg-muted/40',
              )}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {section === 'comments' && target && self ? (
            <CommentThread target={target} authorId={self.userId} authorName={self.name} />
          ) : null}
          {section === 'comments' && !target ? (
            <p className="text-xs text-muted-foreground">일지·문서에서 항목을 선택하면 주석을 달 수 있습니다.</p>
          ) : null}
          {section === 'chat' && roomId && self ? (
            <CollabChatPanel roomId={roomId} userId={self.userId} userName={self.name} />
          ) : null}
          {section === 'chat' && !roomId ? (
            <p className="text-xs text-muted-foreground">룸이 필요합니다. 서버/하이브리드 모드에서 채팅하세요.</p>
          ) : null}
          {section === 'board' && roomId && self ? (
            <CollabWhiteboard roomId={roomId} userId={self.userId} color={self.color} />
          ) : null}
          {section === 'activity' ? <ActivityFeed /> : null}
          {section === 'alerts' ? (
            <p className="text-xs text-muted-foreground">
              헤더 알림 벨에서 멘션·공유·초대·Gate 히스토리를 확인하세요.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
