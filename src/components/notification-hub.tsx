'use client'

/**
 * P61 — 알림 허브 (알림 · 메시지 · 구독 설정)
 */
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'
import {
  Bell,
  CheckCheck,
  Mail,
  MessageSquare,
  Search,
  Send,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useEscapeToClose } from '@/lib/a11y'
import {
  NOTIFICATION_GROUPS,
  clearNotifications,
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
  type NotificationGroup,
  type NotificationItem,
} from '@/lib/notification-center'
import {
  countUnreadMessages,
  ensureMessageChannel,
  listChannelMessages,
  listMessageChannels,
  markMessagesRead,
  postInAppMessage,
  searchMessages,
  subscribeMessages,
  toggleMessageReaction,
  type InAppMessage,
  type MessageChannel,
} from '@/lib/in-app-messaging'
import {
  getNotificationPrefs,
  setNotificationPrefs,
  type DigestCadence,
  type NotificationPrefs,
} from '@/lib/notification-prefs'
import { runNotificationDigest, startDigestScheduler } from '@/lib/email-notify'
import { showFolioPush } from '@/lib/push-notifications'

const KIND_LABEL: Record<string, string> = {
  mention: '멘션',
  invite: '초대',
  share: '공유',
  gate: 'Gate',
  system: '시스템',
  save: '저장',
  message: '메시지',
}

const REACTIONS = ['👍', '👀', '🎉', '❤️']

type HubTab = 'alerts' | 'messages' | 'settings'

function useSelfIdentity() {
  const [self] = useState(() => {
    if (typeof window === 'undefined') return { userId: 'local-user', userName: '나' }
    try {
      const raw = localStorage.getItem('folio_presence_self')
      if (raw) {
        const p = JSON.parse(raw) as { id?: string; name?: string }
        if (p.id) return { userId: p.id, userName: p.name || '나' }
      }
    } catch {
      /* ignore */
    }
    return { userId: 'local-user', userName: '나' }
  })
  return self
}

export function NotificationHubPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const titleId = useId()
  const self = useSelfIdentity()
  const [tab, setTab] = useState<HubTab>('alerts')
  const [group, setGroup] = useState<NotificationGroup | 'all'>('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [channels, setChannels] = useState<MessageChannel[]>([])
  const [channelId, setChannelId] = useState('')
  const [messages, setMessages] = useState<InAppMessage[]>([])
  const [msgText, setMsgText] = useState('')
  const [msgSearch, setMsgSearch] = useState('')
  const [msgHits, setMsgHits] = useState<InAppMessage[]>([])
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => getNotificationPrefs())
  const [status, setStatus] = useState<string | null>(null)

  const refreshAlerts = useCallback(() => {
    setItems(listNotifications(60, { group, unreadOnly, query }))
    setUnread(countUnreadNotifications())
  }, [group, unreadOnly, query])

  const refreshMessages = useCallback(() => {
    const chs = listMessageChannels()
    if (chs.length === 0) {
      const doc = ensureMessageChannel({ kind: 'doc', title: '일반 문서', refId: 'general-doc' })
      const proj = ensureMessageChannel({
        kind: 'project',
        title: '프로젝트',
        refId: 'general-project',
      })
      setChannels([doc, proj])
      setChannelId((id) => id || doc.id)
    } else {
      setChannels(chs)
      setChannelId((id) => id || chs[0]!.id)
    }
    const cid = channelId || chs[0]?.id
    if (cid) {
      setMessages(listChannelMessages(cid))
      markMessagesRead(cid, self.userId)
    }
  }, [channelId, self.userId])

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      refreshAlerts()
      refreshMessages()
      setPrefs(getNotificationPrefs())
    })
  }, [open, refreshAlerts, refreshMessages])

  useEffect(() => subscribeNotifications(refreshAlerts), [refreshAlerts])
  useEffect(() => subscribeMessages(refreshMessages), [refreshMessages])
  useEffect(() => startDigestScheduler(), [])

  useEscapeToClose(open, onClose)

  if (!open) return null

  const sendMessage = () => {
    if (!channelId || !msgText.trim()) return
    postInAppMessage({
      channelId,
      userId: self.userId,
      userName: self.userName,
      text: msgText,
    })
    setMsgText('')
    refreshMessages()
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-start sm:justify-end sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby={titleId}
    >
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div className="relative z-10 flex h-[min(92vh,40rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border bg-background shadow-xl sm:mt-12 sm:rounded-2xl">
        <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <div>
            <h2 id={titleId} className="text-sm font-semibold">
              알림 허브
            </h2>
            <p className="text-[10px] text-muted-foreground">
              미읽음 {unread}
              {countUnreadMessages(self.userId) > 0
                ? ` · 메시지 ${countUnreadMessages(self.userId)}`
                : ''}
            </p>
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex border-b text-[11px]">
          {(
            [
              ['alerts', '알림', Bell],
              ['messages', '메시지', MessageSquare],
              ['settings', '설정', Settings2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              className={cn(
                'flex flex-1 items-center justify-center gap-1 px-2 py-2 font-medium',
                tab === id ? 'border-b-2 border-teal-600 text-foreground' : 'text-muted-foreground',
              )}
              onClick={() => setTab(id)}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'alerts' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="space-y-2 border-b px-3 py-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 pl-7 text-xs"
                  placeholder="알림 검색"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                <FilterChip active={group === 'all'} onClick={() => setGroup('all')}>
                  전체
                </FilterChip>
                {NOTIFICATION_GROUPS.map((g) => (
                  <FilterChip key={g.id} active={group === g.id} onClick={() => setGroup(g.id)}>
                    {g.label}
                  </FilterChip>
                ))}
                <FilterChip active={unreadOnly} onClick={() => setUnreadOnly((v) => !v)}>
                  안 읽음
                </FilterChip>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-1.5 text-[10px]"
                  onClick={() => {
                    markAllNotificationsRead(group === 'all' ? undefined : group)
                    refreshAlerts()
                  }}
                >
                  <CheckCheck className="size-3.5" /> 모두 읽음
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-1.5 text-[10px]"
                  onClick={() => {
                    clearNotifications(group === 'all' ? undefined : group)
                    refreshAlerts()
                  }}
                >
                  <Trash2 className="size-3.5" /> 비우기
                </Button>
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto p-2">
              {items.length === 0 ? (
                <li className="px-2 py-8 text-center text-[11px] text-muted-foreground">알림이 없습니다.</li>
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
                        refreshAlerts()
                        if (n.url) window.location.assign(n.url)
                        onClose()
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-medium text-teal-700 dark:text-teal-400">
                          {KIND_LABEL[n.kind] ?? n.kind} · {n.group}
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

        {tab === 'messages' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex gap-1 overflow-x-auto border-b px-2 py-2">
              {channels.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-1 text-[10px]',
                    channelId === c.id ? 'border-teal-600 bg-teal-500/10' : 'border-border',
                  )}
                  onClick={() => {
                    setChannelId(c.id)
                    setMessages(listChannelMessages(c.id))
                    markMessagesRead(c.id, self.userId)
                  }}
                >
                  {c.kind === 'doc' ? '📄' : c.kind === 'project' ? '📁' : '💬'} {c.title}
                </button>
              ))}
            </div>
            <div className="border-b px-3 py-2">
              <Input
                className="h-8 text-xs"
                placeholder="메시지 검색"
                value={msgSearch}
                onChange={(e) => {
                  const v = e.target.value
                  setMsgSearch(v)
                  setMsgHits(v.trim() ? searchMessages(v, channelId || undefined) : [])
                }}
              />
              {msgHits.length > 0 ? (
                <ul className="mt-1 max-h-24 overflow-y-auto text-[10px] text-muted-foreground">
                  {msgHits.map((h) => (
                    <li key={h.id} className="truncate py-0.5">
                      {h.userName}: {h.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2 text-[11px]">
              {messages.length === 0 ? (
                <li className="text-muted-foreground">메시지가 없습니다.</li>
              ) : (
                messages.map((m) => (
                  <li key={m.id} className="rounded-lg border border-border/60 px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{m.userName}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(m.createdAt).toLocaleTimeString('ko-KR')}
                      </span>
                      {m.readBy.length > 1 ? (
                        <span className="ml-auto text-[9px] text-teal-700 dark:text-teal-400">
                          읽음 {m.readBy.length}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words">{m.text}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {REACTIONS.map((emoji) => {
                        const count = m.reactions[emoji]?.length ?? 0
                        const mine = m.reactions[emoji]?.includes(self.userId)
                        return (
                          <button
                            key={emoji}
                            type="button"
                            className={cn(
                              'rounded-full border px-1.5 py-0.5 text-[10px]',
                              mine ? 'border-teal-600 bg-teal-500/10' : 'border-border',
                            )}
                            onClick={() => {
                              toggleMessageReaction(m.id, emoji, self.userId)
                              refreshMessages()
                            }}
                          >
                            {emoji}
                            {count ? ` ${count}` : ''}
                          </button>
                        )
                      })}
                    </div>
                  </li>
                ))
              )}
            </ul>
            <div className="flex gap-1 border-t p-2">
              <Input
                className="h-8 text-xs"
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="메시지…"
              />
              <Button type="button" size="icon" className="h-8 w-8" onClick={sendMessage} disabled={!msgText.trim()}>
                <Send className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : null}

        {tab === 'settings' ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 text-xs">
            <section className="space-y-2 rounded-xl border p-3">
              <p className="flex items-center gap-1.5 font-medium">
                <Mail className="size-3.5" /> 이메일
              </p>
              <Input
                className="h-8 text-xs"
                type="email"
                placeholder="you@example.com"
                value={prefs.email}
                onChange={(e) => setPrefs(setNotificationPrefs({ email: e.target.value }))}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs.emailImportant}
                  onChange={(e) =>
                    setPrefs(setNotificationPrefs({ emailImportant: e.target.checked }))
                  }
                />
                중요 알림 즉시 메일
              </label>
              <label className="flex flex-col gap-1">
                요약 메일
                <select
                  className="h-8 rounded-md border bg-background px-2"
                  value={prefs.digest}
                  onChange={(e) =>
                    setPrefs(setNotificationPrefs({ digest: e.target.value as DigestCadence }))
                  }
                >
                  <option value="off">끄기</option>
                  <option value="daily">일일</option>
                  <option value="weekly">주간</option>
                </select>
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => {
                  void runNotificationDigest().then((r) =>
                    setStatus(r.ok ? '요약 메일 전송(또는 outbox)' : r.reason || '실패'),
                  )
                }}
              >
                지금 요약 보내기
              </Button>
            </section>

            <section className="space-y-2 rounded-xl border p-3">
              <p className="font-medium">유형별 구독</p>
              {NOTIFICATION_GROUPS.map((g) => {
                const row = prefs.groups[g.id]
                return (
                  <div key={g.id} className="flex flex-wrap items-center gap-2 border-b border-border/50 py-1.5 last:border-0">
                    <span className="w-14 text-[11px] font-medium">{g.label}</span>
                    {(['inApp', 'email', 'push'] as const).map((k) => (
                      <label key={k} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={row[k]}
                          onChange={(e) => {
                            setPrefs(
                              setNotificationPrefs({
                                groups: {
                                  ...prefs.groups,
                                  [g.id]: { ...row, [k]: e.target.checked },
                                },
                              }),
                            )
                          }}
                        />
                        {k === 'inApp' ? '앱' : k === 'email' ? '메일' : '푸시'}
                      </label>
                    ))}
                  </div>
                )
              })}
            </section>

            <section className="space-y-2 rounded-xl border p-3">
              <p className="font-medium">푸시 · 소리/진동</p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs.pushSound}
                  onChange={(e) => setPrefs(setNotificationPrefs({ pushSound: e.target.checked }))}
                />
                소리 (silent 해제)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs.pushVibrate}
                  onChange={(e) => setPrefs(setNotificationPrefs({ pushVibrate: e.target.checked }))}
                />
                진동
              </label>
              <label className="flex flex-col gap-1">
                진동 패턴 (ms, 쉼표)
                <Input
                  className="h-8 text-xs"
                  value={prefs.vibratePattern.join(',')}
                  onChange={(e) => {
                    const vibratePattern = e.target.value
                      .split(',')
                      .map((x) => Number(x.trim()))
                      .filter((n) => Number.isFinite(n) && n >= 0)
                    setPrefs(setNotificationPrefs({ vibratePattern: vibratePattern.length ? vibratePattern : [120, 60, 120] }))
                  }}
                />
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => {
                  void showFolioPush({
                    title: 'Folio rich 알림',
                    body: '이미지·버튼·그룹 테스트',
                    url: '/',
                    group: 'system',
                    thread: 'prefs-test',
                    image: '/icons/icon-192.png',
                    actions: [
                      { action: 'open', title: '열기' },
                      { action: 'dismiss', title: '닫기' },
                    ],
                    kind: 'system',
                  }).then(() => setStatus('테스트 푸시 표시'))
                }}
              >
                rich 푸시 테스트
              </Button>
            </section>

            {status ? <p className="text-[10px] text-muted-foreground">{status}</p> : null}
            <p className="text-[10px] text-muted-foreground">
              이메일: <code>RESEND_API_KEY</code> + <code>FOLIO_EMAIL_FROM</code> 설정 시 발송, 없으면
              <code className="mx-1">.data/email-outbox</code>에 기록됩니다.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2 py-0.5 text-[10px]',
        active ? 'border-teal-600 bg-teal-500/10' : 'border-border text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function NotificationHubButton() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const self = useSelfIdentity()

  const refresh = useCallback(() => {
    setUnread(countUnreadNotifications() + countUnreadMessages(self.userId))
  }, [self.userId])

  useEffect(() => {
    const unsub = [
      subscribeNotifications(refresh),
      subscribeMessages(refresh),
    ]
    const id = window.setTimeout(refresh, 0)
    return () => {
      unsub.forEach((u) => u())
      window.clearTimeout(id)
    }
  }, [refresh])

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 min-h-[40px] min-w-[40px]"
        aria-label="알림 허브"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[9px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </Button>
      <NotificationHubPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** 하위 호환 — 기존 NotificationCenterButton 이름 */
export { NotificationHubButton as NotificationCenterButton }
