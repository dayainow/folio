'use client'

/**
 * P45 — 알림 센터 (히스토리 · 미읽음)
 */
import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCheck, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  clearNotifications,
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
  type NotificationItem,
} from '@/lib/notification-center'
import { useEscapeToClose } from '@/lib/a11y'
import { cn } from '@/lib/utils'

const KIND_LABEL: Record<string, string> = {
  mention: '멘션',
  invite: '초대',
  share: '공유',
  gate: 'Gate',
  system: '시스템',
}

export function NotificationCenterButton() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)

  const refresh = useCallback(() => {
    setItems(listNotifications(40))
    setUnread(countUnreadNotifications())
  }, [])

  useEffect(() => subscribeNotifications(refresh), [refresh])
  useEffect(() => {
    const id = window.setTimeout(refresh, 0)
    return () => window.clearTimeout(id)
  }, [refresh])

  useEscapeToClose(open, () => setOpen(false))

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 min-h-[40px] min-w-[40px]"
        aria-label="알림 센터"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v)
          if (!open) refresh()
        }}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[9px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          className="absolute right-0 z-[70] mt-1 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-background shadow-xl"
          role="dialog"
          aria-label="알림 히스토리"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="text-xs font-semibold">알림</span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-1.5 text-[10px]"
                onClick={() => {
                  markAllNotificationsRead()
                  refresh()
                }}
                title="모두 읽음"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-1.5 text-[10px]"
                onClick={() => {
                  clearNotifications()
                  refresh()
                }}
                title="비우기"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setOpen(false)}
                aria-label="닫기"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <ul className="max-h-80 overflow-y-auto p-2">
            {items.length === 0 ? (
              <li className="px-2 py-6 text-center text-[11px] text-muted-foreground">
                알림이 없습니다.
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      'mb-1 w-full rounded-lg px-2.5 py-2 text-left hover:bg-muted/50',
                      !n.read && 'bg-teal-500/5',
                    )}
                    onClick={() => {
                      markNotificationRead(n.id)
                      refresh()
                      if (n.url) window.location.assign(n.url)
                      setOpen(false)
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-medium text-teal-700 dark:text-teal-400">
                        {KIND_LABEL[n.kind] ?? n.kind}
                      </span>
                      <time className="text-[9px] text-muted-foreground" dateTime={n.createdAt}>
                        {new Date(n.createdAt).toLocaleString('ko-KR', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                    <p className="mt-0.5 text-[12px] font-medium leading-snug">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{n.body}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
