import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/** POST /api/notify — { message, channels?: ('slack'|'discord')[] } */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string
      channels?: Array<'slack' | 'discord'>
    }

    const message = body.message?.trim()
    if (!message) {
      return NextResponse.json({ error: 'message가 필요합니다.' }, { status: 400 })
    }

    const [{ isDiscordConfigured, sendDiscordNotification }, { isSlackConfigured, sendSlackNotification }] =
      await Promise.all([import('@/lib/discord'), import('@/lib/slack')])

    const channels = body.channels?.length ? body.channels : (['slack', 'discord'] as const)
    const results: Record<string, { ok: boolean; skipped?: boolean }> = {}

    for (const ch of channels) {
      if (ch === 'slack') {
        if (!isSlackConfigured()) {
          results.slack = { ok: true, skipped: true }
        } else {
          results.slack = await sendSlackNotification(message)
        }
      }
      if (ch === 'discord') {
        if (!isDiscordConfigured()) {
          results.discord = { ok: true, skipped: true }
        } else {
          results.discord = await sendDiscordNotification(message)
        }
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알림 전송 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
