/**
 * P47 — 연속 저장 실패 시 Slack/Discord/푸시 알림
 */
'use client'

import {
  getConsecutiveSaveFailures,
  getStorageAlertThreshold,
  recordAudit,
  type AuditLogEntry,
} from '@/lib/audit-log'
import { notifyChannels } from '@/lib/notify-client'
import type { StorageMode } from '@/lib/storage'

const ALERT_COOLDOWN_MS = 90_000
let lastAlertAt = 0

/**
 * 연속 실패가 임계값 이상이면 알림 (쿨다운 적용)
 */
export async function maybeAlertConsecutiveSaveFailures(opts: {
  mode: StorageMode
  type: string
  error?: string
  streak?: number
}): Promise<{ alerted: boolean; streak: number; entry?: AuditLogEntry }> {
  const streak = opts.streak ?? getConsecutiveSaveFailures()
  const threshold = getStorageAlertThreshold()
  if (streak < threshold) return { alerted: false, streak }

  const now = Date.now()
  if (now - lastAlertAt < ALERT_COOLDOWN_MS) {
    return { alerted: false, streak }
  }
  lastAlertAt = now

  const message =
    `🚨 Folio 저장 연속 실패 ${streak}회 (임계 ${threshold})\n` +
    `mode=${opts.mode} · type=${opts.type}` +
    (opts.error ? `\n${opts.error}` : '')

  await notifyChannels(message, {
    channels: ['slack', 'discord'],
    body: message,
    deepLink: { tab: 'journal' },
    actionLabel: 'Folio 열기',
  })

  try {
    const { showFolioPush } = await import('@/lib/push-notifications')
    void showFolioPush({
      title: '저장 연속 실패',
      body: `${streak}회 연속 실패 · ${opts.mode}/${opts.type}`,
      tag: 'folio-storage-alert',
    })
  } catch {
    /* ignore */
  }

  const entry = recordAudit({
    mode: opts.mode,
    type: opts.type,
    action: 'alert',
    change: `연속 실패 알림 (${streak}회)`,
    status: 'failure',
    error: opts.error,
  })

  return { alerted: true, streak, entry }
}
