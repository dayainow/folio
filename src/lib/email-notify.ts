/**
 * P61 — 이메일 알림 클라이언트 (중요 알림 · 다이제스트)
 */
'use client'

import { csrfHeaders } from '@/lib/csrf'
import {
  digestDue,
  getNotificationPrefs,
  setNotificationPrefs,
  shouldEmailGroup,
} from '@/lib/notification-prefs'
import {
  groupForKind,
  listNotifications,
  type NotificationItem,
  type NotificationKind,
} from '@/lib/notification-center'

export async function sendEmailNotification(input: {
  to?: string
  subject: string
  text: string
  html?: string
  kind?: 'important' | 'digest'
}): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const prefs = getNotificationPrefs()
  const to = (input.to || prefs.email).trim()
  if (!to.includes('@')) return { ok: false, reason: 'no_email' }

  try {
    const res = await fetch('/api/email/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({
        to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        kind: input.kind ?? 'important',
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, reason: (err as { error?: string }).error || `http_${res.status}` }
    }
    return (await res.json()) as { ok: boolean; skipped?: boolean; reason?: string }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

/** 알림 추가 직후 — 중요 그룹이면 이메일 */
export async function maybeEmailForNotification(
  item: Pick<NotificationItem, 'kind' | 'title' | 'body' | 'group'>,
): Promise<void> {
  const prefs = getNotificationPrefs()
  if (!prefs.emailImportant) return
  const group = item.group ?? groupForKind(item.kind as NotificationKind)
  if (!shouldEmailGroup(group)) return
  // 저장은 기본적으로 즉시 메일 제외 (prefs로 켠 경우만)
  if (group === 'save' && !prefs.groups.save.email) return
  await sendEmailNotification({
    subject: `[Folio] ${item.title}`,
    text: item.body,
    kind: 'important',
  })
}

export function buildDigestBody(items: NotificationItem[]): { text: string; html: string } {
  if (items.length === 0) {
    return { text: '지난 기간 새 알림이 없습니다.', html: '<p>지난 기간 새 알림이 없습니다.</p>' }
  }
  const lines = items.map(
    (n) => `• [${n.group}] ${n.title} — ${n.body.slice(0, 100)} (${n.createdAt.slice(0, 16)})`,
  )
  const text = `Folio 알림 요약 (${items.length}건)\n\n${lines.join('\n')}`
  const html = `<h2>Folio 알림 요약 (${items.length}건)</h2><ul>${items
    .map(
      (n) =>
        `<li><strong>[${n.group}] ${escapeHtml(n.title)}</strong><br/><span>${escapeHtml(n.body.slice(0, 140))}</span></li>`,
    )
    .join('')}</ul>`
  return { text, html }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function runNotificationDigest(): Promise<{ ok: boolean; reason?: string }> {
  if (!digestDue()) return { ok: false, reason: 'not_due' }
  const prefs = getNotificationPrefs()
  const since = prefs.lastDigestAt ? Date.parse(prefs.lastDigestAt) : 0
  const items = listNotifications(80).filter((n) => Date.parse(n.createdAt) >= since)
  const { text, html } = buildDigestBody(items)
  const cadence = prefs.digest === 'weekly' ? '주간' : '일일'
  const result = await sendEmailNotification({
    subject: `[Folio] ${cadence} 알림 요약`,
    text,
    html,
    kind: 'digest',
  })
  if (result.ok || result.skipped) {
    setNotificationPrefs({ lastDigestAt: new Date().toISOString() })
  }
  return result.ok || result.skipped
    ? { ok: true, reason: result.reason }
    : { ok: false, reason: result.reason }
}

export function startDigestScheduler(): () => void {
  if (typeof window === 'undefined') return () => undefined
  const tick = () => {
    void runNotificationDigest()
  }
  tick()
  const id = window.setInterval(tick, 60 * 60_000)
  return () => window.clearInterval(id)
}
