import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function resolveActionUrl(request: Request, actionUrl?: string): string | undefined {
  const raw = actionUrl?.trim()
  if (!raw) return undefined
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw

  const origin =
    process.env.NEXT_PUBLIC_FOLIO_URL?.replace(/\/$/, '') ||
    process.env.FOLIO_PUBLIC_URL?.replace(/\/$/, '') ||
    request.headers.get('origin') ||
    ''
  if (!origin) return undefined
  if (raw.startsWith('/')) return `${origin}${raw}`
  return `${origin}/${raw}`
}

/** POST /api/notify — { message, body?, channels?, actionUrl?, actionLabel? } */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string
      body?: string
      channels?: Array<'slack' | 'discord'>
      actionUrl?: string
      actionLabel?: string
    }

    const message = body.message?.trim()
    if (!message) {
      return NextResponse.json({ error: 'message가 필요합니다.' }, { status: 400 })
    }

    const [{ isDiscordConfigured, sendDiscordNotification }, { isSlackConfigured, sendSlackNotification }] =
      await Promise.all([import('@/lib/discord'), import('@/lib/slack')])

    const channels = body.channels?.length ? body.channels : (['slack', 'discord'] as const)
    const results: Record<string, { ok: boolean; skipped?: boolean }> = {}
    const actionUrl = resolveActionUrl(request, body.actionUrl)
    const actionLabel = body.actionLabel?.trim() || '확인'
    const detail = body.body?.trim()

    for (const ch of channels) {
      if (ch === 'slack') {
        if (!isSlackConfigured()) {
          results.slack = { ok: true, skipped: true }
        } else {
          results.slack = await sendSlackNotification({
            text: message,
            body: detail ?? message,
            actions: actionUrl ? [{ text: actionLabel, url: actionUrl }] : undefined,
          })
        }
      }
      if (ch === 'discord') {
        if (!isDiscordConfigured()) {
          results.discord = { ok: true, skipped: true }
        } else {
          const discordText = actionUrl
            ? `${detail ?? message}\n[확인](${actionUrl})`
            : (detail ?? message)
          results.discord = await sendDiscordNotification(discordText)
        }
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알림 전송 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
