/**
 * P45 — 알림 센터 / 히스토리
 * 멘션 · 공유 · 초대 · Gate 알림을 로컬에 보관하고 미읽음 배지를 제공한다.
 */
'use client'

import type { TeamNotifyKind, TeamNotifyPayload } from '@/lib/collab-notify'

export type NotificationItem = {
  id: string
  kind: TeamNotifyKind | 'system'
  title: string
  body: string
  url?: string
  createdAt: string
  read: boolean
  meta?: Record<string, unknown>
}

const KEY = 'folio_notification_center_v1'
const MAX = 100
const CHANGE = 'folio-notifications-changed'

function readAll(): NotificationItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as NotificationItem[]
    return Array.isArray(parsed) ? parsed : []
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

export function listNotifications(limit = 50): NotificationItem[] {
  return readAll()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

export function countUnreadNotifications(): number {
  return readAll().filter((n) => !n.read).length
}

export function pushNotification(
  input: Omit<NotificationItem, 'id' | 'createdAt' | 'read'> & {
    id?: string
    createdAt?: string
    read?: boolean
  },
): NotificationItem {
  const item: NotificationItem = {
    id: input.id ?? crypto.randomUUID(),
    kind: input.kind,
    title: input.title,
    body: input.body,
    url: input.url,
    createdAt: input.createdAt ?? new Date().toISOString(),
    read: input.read ?? false,
    meta: input.meta,
  }
  const all = readAll().filter((n) => n.id !== item.id)
  writeAll([item, ...all])
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

export function markNotificationRead(id: string): void {
  writeAll(readAll().map((n) => (n.id === id ? { ...n, read: true } : n)))
}

export function markAllNotificationsRead(): void {
  writeAll(readAll().map((n) => ({ ...n, read: true })))
}

export function clearNotifications(): void {
  writeAll([])
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
