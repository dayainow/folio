/**
 * P61 — 알림 구독 설정 (이메일 · 푸시 · 유형별)
 */
'use client'

import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache'
import type { NotificationGroup } from '@/lib/notification-center'

export type DigestCadence = 'off' | 'daily' | 'weekly'

export type NotificationPrefs = {
  email: string
  /** 중요 알림 즉시 이메일 */
  emailImportant: boolean
  digest: DigestCadence
  /** 그룹별 인앱/이메일/푸시 구독 */
  groups: Record<
    NotificationGroup,
    { inApp: boolean; email: boolean; push: boolean }
  >
  /** rich push */
  pushSound: boolean
  pushVibrate: boolean
  vibratePattern: number[]
  lastDigestAt: string | null
}

const KEY = 'folio_notification_prefs_v1'

function defaultGroups(): NotificationPrefs['groups'] {
  const g = (email: boolean): NotificationPrefs['groups'][NotificationGroup] => ({
    inApp: true,
    email,
    push: true,
  })
  return {
    save: g(false),
    collab: g(true),
    gate: g(true),
    invite: g(true),
    system: g(true),
  }
}

export function defaultNotificationPrefs(): NotificationPrefs {
  return {
    email: '',
    emailImportant: true,
    digest: 'daily',
    groups: defaultGroups(),
    pushSound: true,
    pushVibrate: true,
    vibratePattern: [120, 60, 120],
    lastDigestAt: null,
  }
}

export function getNotificationPrefs(): NotificationPrefs {
  const raw = getLocalJson<Partial<NotificationPrefs>>(KEY, {})
  const base = defaultNotificationPrefs()
  return {
    ...base,
    ...raw,
    groups: { ...base.groups, ...(raw.groups ?? {}) },
    vibratePattern: Array.isArray(raw.vibratePattern)
      ? raw.vibratePattern
      : base.vibratePattern,
  }
}

export function setNotificationPrefs(patch: Partial<NotificationPrefs>): NotificationPrefs {
  const next = { ...getNotificationPrefs(), ...patch }
  if (patch.groups) {
    next.groups = { ...getNotificationPrefs().groups, ...patch.groups }
  }
  setLocalJson(KEY, next)
  flushLocalJson(KEY)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('folio-notification-prefs'))
  }
  return next
}

export function shouldEmailGroup(group: NotificationGroup): boolean {
  const p = getNotificationPrefs()
  if (!p.email?.includes('@')) return false
  return p.groups[group]?.email === true
}

export function shouldPushGroup(group: NotificationGroup): boolean {
  return getNotificationPrefs().groups[group]?.push !== false
}

export function shouldInAppGroup(group: NotificationGroup): boolean {
  return getNotificationPrefs().groups[group]?.inApp !== false
}

export function digestDue(now = Date.now()): boolean {
  const p = getNotificationPrefs()
  if (p.digest === 'off' || !p.email?.includes('@')) return false
  if (!p.lastDigestAt) return true
  const last = Date.parse(p.lastDigestAt)
  if (!Number.isFinite(last)) return true
  const hours = p.digest === 'daily' ? 24 : 24 * 7
  return now - last >= hours * 3600_000
}
