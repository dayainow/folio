'use client'

/**
 * P41 — 협업 패널 (Presence · 주석 · 활동 스트림)
 */
import { useEffect, useState } from 'react'
import { Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PresenceAvatars } from '@/components/presence-avatars'
import { CommentThread } from '@/components/comment-thread'
import { ActivityFeed } from '@/components/activity-feed'
import { usePresence } from '@/hooks/use-collab'
import { useEscapeToClose } from '@/lib/a11y'
import { cn } from '@/lib/utils'

export type CollabPanelProps = {
  open: boolean
  onClose: () => void
  /** 예: journal:2026-08-02 · doc:<id> · team:<id> */
  roomId: string | null
  target: { kind: 'doc' | 'journal'; id: string } | null
  tabLabel?: string
}

export function CollabPanel({ open, onClose, roomId, target, tabLabel }: CollabPanelProps) {
  const { peers, self, transport } = usePresence(open ? roomId : null, tabLabel)
  const [section, setSection] = useState<'comments' | 'activity'>('comments')

  useEscapeToClose(open, onClose)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="실시간 협업">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="닫기"
        onClick={onClose}
      />
      <aside
        className={cn(
          'absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-background shadow-xl',
        )}
      >
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
          <Button type="button" size="icon" variant="ghost" className="size-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <PresenceAvatars peers={peers} />
          <span className="text-[11px] text-muted-foreground">
            {self ? `${self.name}` : '…'}
            {peers.length > 0 ? ` · +${peers.length}` : ' · 혼자'}
          </span>
        </div>

        <div className="flex gap-1 border-b border-border px-3 py-2">
          {(
            [
              ['comments', '주석'],
              ['activity', '활동'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                'rounded-md px-3 py-1.5 text-xs',
                section === id ? 'bg-foreground/5 font-medium' : 'text-muted-foreground hover:bg-muted/40',
              )}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {section === 'comments' && target && self ? (
            <CommentThread
              target={target}
              authorId={self.userId}
              authorName={self.name}
            />
          ) : null}
          {section === 'comments' && !target ? (
            <p className="text-xs text-muted-foreground">일지·문서에서 항목을 선택하면 주석을 달 수 있습니다.</p>
          ) : null}
          {section === 'activity' ? <ActivityFeed /> : null}
        </div>
      </aside>
    </div>
  )
}
