/**
 * Slack Incoming Webhook (서버 전용).
 * SLACK_WEBHOOK_URL 미설정 시 조용히 스킵.
 */

export function isSlackConfigured(): boolean {
  const url = process.env.SLACK_WEBHOOK_URL
  return !!url && url !== 'your-slack-webhook-url' && url.startsWith('https://')
}

/** webhook으로 메시지 전송. 미설정이면 skipped */
export async function sendSlackNotification(message: string): Promise<{ ok: boolean; skipped?: boolean }> {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url || url === 'your-slack-webhook-url' || !url.startsWith('https://')) {
    return { ok: true, skipped: true }
  }

  const text = message.trim()
  if (!text) return { ok: true, skipped: true }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Slack webhook ${res.status}: ${body || res.statusText}`)
  }

  return { ok: true }
}
