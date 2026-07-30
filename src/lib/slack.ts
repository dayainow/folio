/**
 * Slack Incoming Webhook (서버 전용).
 * SLACK_WEBHOOK_URL 미설정 시 조용히 스킵.
 * 링크 버튼(url)은 Interactive App 없이도 Incoming Webhook에서 동작한다.
 */

export function isSlackConfigured(): boolean {
  const url = process.env.SLACK_WEBHOOK_URL
  return !!url && url !== 'your-slack-webhook-url' && url.startsWith('https://')
}

export type SlackActionButton = {
  text: string
  url: string
}

export type SlackNotifyPayload = {
  text: string
  /** mrkdwn 본문 (없으면 text 사용) */
  body?: string
  actions?: SlackActionButton[]
}

type SlackBlock = Record<string, unknown>

function buildBlocks(payload: SlackNotifyPayload): SlackBlock[] {
  const body = (payload.body ?? payload.text).trim()
  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: body.slice(0, 2900) },
    },
  ]

  const actions = (payload.actions ?? []).filter((a) => a.url?.startsWith('http'))
  if (actions.length > 0) {
    blocks.push({
      type: 'actions',
      elements: actions.slice(0, 5).map((a, i) => ({
        type: 'button',
        text: { type: 'plain_text', text: a.text.slice(0, 75) || '확인', emoji: true },
        url: a.url,
        action_id: `folio_open_${i}`,
      })),
    })
  }

  return blocks
}

/** webhook으로 메시지 전송. 미설정이면 skipped */
export async function sendSlackNotification(
  messageOrPayload: string | SlackNotifyPayload,
): Promise<{ ok: boolean; skipped?: boolean }> {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url || url === 'your-slack-webhook-url' || !url.startsWith('https://')) {
    return { ok: true, skipped: true }
  }

  const payload: SlackNotifyPayload =
    typeof messageOrPayload === 'string'
      ? { text: messageOrPayload }
      : messageOrPayload

  const text = payload.text.trim()
  if (!text) return { ok: true, skipped: true }

  const body: Record<string, unknown> = { text }
  if (payload.body || (payload.actions && payload.actions.length > 0)) {
    body.blocks = buildBlocks(payload)
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`Slack webhook ${res.status}: ${errBody || res.statusText}`)
  }

  return { ok: true }
}
