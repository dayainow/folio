/**
 * P50 — 성능 임계 초과 시 Slack/Discord/푸시 알림
 */
'use client'

import {
  recordPerfMetric,
  type WebVitalName,
  WEB_VITAL_THRESHOLDS,
  rateWebVital,
} from '@/lib/perf-metrics'
import { notifyChannels } from '@/lib/notify-client'

const COOLDOWN_MS = 120_000
const lastAlertAt = new Map<string, number>()

function canAlert(key: string): boolean {
  const now = Date.now()
  const prev = lastAlertAt.get(key) ?? 0
  if (now - prev < COOLDOWN_MS) return false
  lastAlertAt.set(key, now)
  return true
}

export async function maybeAlertWebVital(input: {
  name: WebVitalName
  value: number
  path?: string
}): Promise<{ alerted: boolean }> {
  const rating = rateWebVital(input.name, input.value)
  if (rating !== 'poor') return { alerted: false }

  const key = `vital:${input.name}`
  if (!canAlert(key)) return { alerted: false }

  const thr = WEB_VITAL_THRESHOLDS[input.name]
  const message =
    `⚠️ Folio Web Vital 임계 초과: ${input.name}=${input.value}` +
    ` (poor>${thr.poor}${thr.unit === 'ms' ? 'ms' : ''})` +
    (input.path ? `\npath=${input.path}` : '')

  await notifyChannels(message, {
    channels: ['slack', 'discord'],
    body: message,
    deepLink: { tab: 'journal' },
    actionLabel: 'Folio 열기',
  })

  try {
    const { showFolioPush } = await import('@/lib/push-notifications')
    void showFolioPush({
      title: '성능 저하 감지',
      body: `${input.name} ${input.value} (poor)`,
      tag: 'folio-perf-vital',
    })
  } catch {
    /* ignore */
  }

  recordPerfMetric({
    kind: 'alert',
    name: `vital.${input.name}`,
    value: input.value,
    unit: thr.unit,
    path: input.path,
    ok: false,
    detail: 'web_vital_threshold',
    rating: 'poor',
  })

  return { alerted: true }
}

export async function maybeAlertApiSlow(input: {
  path: string
  durationMs: number
  thresholdMs?: number
}): Promise<{ alerted: boolean }> {
  const threshold = input.thresholdMs ?? Number(process.env.NEXT_PUBLIC_PERF_API_SLOW_MS ?? 3000)
  if (input.durationMs < threshold) return { alerted: false }
  // 알림 채널 자체 호출은 재귀·노이즈 방지
  if (input.path.startsWith('/api/notify') || input.path.startsWith('/api/push/')) {
    return { alerted: false }
  }

  const key = `api:${input.path}`
  if (!canAlert(key)) return { alerted: false }

  const message =
    `🐢 Folio API 지연: ${input.path} ${Math.round(input.durationMs)}ms` +
    ` (임계 ${threshold}ms)`

  await notifyChannels(message, {
    channels: ['slack', 'discord'],
    body: message,
    deepLink: { tab: 'journal' },
    actionLabel: 'Folio 열기',
  })

  recordPerfMetric({
    kind: 'alert',
    name: 'api.slow',
    value: input.durationMs,
    unit: 'ms',
    path: input.path,
    ok: false,
    detail: 'api_slow',
  })

  return { alerted: true }
}
