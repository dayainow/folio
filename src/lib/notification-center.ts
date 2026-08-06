/**
 * P61 — 알림 센터 확장 (그룹 · 필터 · 저장/시스템 알림)
 */
'use client'

import type { TeamNotifyKind, TeamNotifyPayload } from '@/lib/collab-notify'

export type NotificationKind = TeamNotifyKind | 'system' | 'save' | 'message'

/** 허브 그룹화 */
export type NotificationGroup = 'save' | 'collab' | 'gate' | 'invite' | 'system'

export type NotificationItem = {
  id: string
  kind: NotificationKind
  group: NotificationGroup
  title: string
  body: string
  url?: string
  createdAt: string
  read: boolean
  meta?: Record<string, unknown>
}

const KEY = 'folio_notification_center_v1'
const MAX = 120
const CHANGE = 'folio-notifications-changed'

export const NOTIFICATION_GROUPS: { id: NotificationGroup; label: string }[] = [
  { id: 'save', label: '저장' },
  { id: 'collab', label: '협업' },
  { id: 'gate', label: 'Gate' },
  { id: 'invite', label: '팀 초대' },
  { id: 'system', label: '시스템' },
]

export function groupForKind(kind: NotificationKind): NotificationGroup {
  switch (kind) {
    case 'save':
      return 'save'
    case 'mention':
    case 'share':
    case 'message':
      return 'collab'
    case 'gate':
      return 'gate'
    case 'invite':
      return 'invite'
    case 'system':
    default:
      return 'system'
  }
}

function normalize(raw: unknown): NotificationItem | null {
  if (!raw || typeof raw !== 'object') return null
  const n = raw as Partial<NotificationItem> & { kind?: string }
  if (!n.id || !n.title || !n.kind) return null
  const kind = n.kind as NotificationKind
  return {
    id: n.id,
    kind,
    group: n.group ?? groupForKind(kind),
    title: n.title,
    body: n.body ?? '',
    url: n.url,
    createdAt: n.createdAt ?? new Date().toISOString(),
    read: Boolean(n.read),
    meta: n.meta,
  }
}

function readAll(): NotificationItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalize).filter((x): x is NotificationItem => Boolean(x))
  } catch {
    return []
  }
}

function writeAll(items: NotificationItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)))
    window.dispatchEvent(new CustomEvent(CHANGE))
  } catch {
    /* quota */
  }
}

export type NotificationFilter = {
  group?: NotificationGroup | 'all'
  unreadOnly?: boolean
  query?: string
}

export function listNotifications(
  limit = 50,
  filter: NotificationFilter = {},
): NotificationItem[] {
  let list = readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (filter.group && filter.group !== 'all') {
    list = list.filter((n) => n.group === filter.group)
  }
  if (filter.unreadOnly) list = list.filter((n) => !n.read)
  const q = filter.query?.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.kind.toLowerCase().includes(q),
    )
  }
  return list.slice(0, limit)
}

export function groupNotifications(
  items: NotificationItem[],
): Record<NotificationGroup, NotificationItem[]> {
  const out: Record<NotificationGroup, NotificationItem[]> = {
    save: [],
    collab: [],
    gate: [],
    invite: [],
    system: [],
  }
  for (const n of items) out[n.group].push(n)
  return out
}

export function countUnreadNotifications(group?: NotificationGroup): number {
  return readAll().filter((n) => !n.read && (!group || n.group === group)).length
}

export function pushNotification(
  input: Omit<NotificationItem, 'id' | 'createdAt' | 'read' | 'group'> & {
    id?: string
    createdAt?: string
    read?: boolean
    group?: NotificationGroup
  },
): NotificationItem {
  const item: NotificationItem = {
    id: input.id ?? crypto.randomUUID(),
    kind: input.kind,
    group: input.group ?? groupForKind(input.kind),
    title: input.title,
    body: input.body,
    url: input.url,
    createdAt: input.createdAt ?? new Date().toISOString(),
    read: input.read ?? false,
    meta: input.meta,
  }
  const all = readAll().filter((n) => n.id !== item.id)
  writeAll([item, ...all])
  void import('@/lib/email-notify')
    .then(({ maybeEmailForNotification }) => maybeEmailForNotification(item))
    .catch(() => undefined)
  return item
}

export function pushFromTeamNotify(payload: TeamNotifyPayload): NotificationItem {
  return pushNotification({
    kind: payload.kind,
    title: payload.title,
    body: payload.body,
    url: payload.url,
    meta: {
      teamId: payload.teamId,
      actorId: payload.actorId,
      actorName: payload.actorName,
      mentionTargets: payload.mentionTargets,
    },
  })
}

export function pushSaveNotification(title: string, body: string, url?: string) {
  return pushNotification({ kind: 'save', title, body, url })
}

export function markNotificationRead(id: string): void {
  writeAll(readAll().map((n) => (n.id === id ? { ...n, read: true } : n)))
}

export function markAllNotificationsRead(group?: NotificationGroup): void {
  writeAll(
    readAll().map((n) =>
      !group || n.group === group ? { ...n, read: true } : n,
    ),
  )
}

export function clearNotifications(group?: NotificationGroup): void {
  if (!group) {
    writeAll([])
    return
  }
  writeAll(readAll().filter((n) => n.group !== group))
}

export function subscribeNotifications(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const h = () => cb()
  window.addEventListener(CHANGE, h)
  window.addEventListener('storage', h)
  return () => {
    window.removeEventListener(CHANGE, h)
    window.removeEventListener('storage', h)
  }
}
