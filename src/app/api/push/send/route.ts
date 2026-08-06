import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

type PushSubscriptionJSON = {
  endpoint: string
  keys?: { p256dh?: string; auth?: string }
}

const STORE = path.join(process.cwd(), '.beacon', 'cache', 'folio-push-subscriptions.json')

async function readSubs(): Promise<PushSubscriptionJSON[]> {
  try {
    const raw = await fs.readFile(STORE, 'utf8')
    const parsed = JSON.parse(raw) as { subscriptions?: PushSubscriptionJSON[] }
    return Array.isArray(parsed.subscriptions) ? parsed.subscriptions : []
  } catch {
    return []
  }
}

function vapidConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const priv = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:folio@localhost'
  return Boolean(pub && priv && subject)
}

/** POST /api/push/send — Web Push 브로드캐스트 (rich payload) */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string
      body?: string
      url?: string
      tag?: string
      image?: string
      actions?: Array<{ action: string; title: string }>
      group?: string
      thread?: string
      renotify?: boolean
      vibrate?: number[]
      silent?: boolean
    }
    const title = body.title?.trim() || 'Folio'
    const text = body.body?.trim() || ''
    if (!text && !body.title) {
      return NextResponse.json({ error: 'title 또는 body가 필요합니다.' }, { status: 400 })
    }

    if (!vapidConfigured()) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'vapid_not_configured' })
    }

    const webpush = await import('web-push')
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!.trim() || 'mailto:folio@localhost',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
      process.env.VAPID_PRIVATE_KEY!.trim(),
    )

    const subs = await readSubs()
    if (subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const payload = JSON.stringify({
      title,
      body: text,
      url: body.url || '/',
      tag: body.tag,
      image: body.image,
      actions: body.actions,
      group: body.group,
      thread: body.thread,
      renotify: body.renotify,
      vibrate: body.vibrate,
      silent: body.silent,
    })

    let sent = 0
    const stale: string[] = []
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(sub as Parameters<typeof webpush.sendNotification>[0], payload)
          sent += 1
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode
          if (status === 404 || status === 410) stale.push(sub.endpoint)
        }
      }),
    )

    if (stale.length > 0) {
      await fs.mkdir(path.dirname(STORE), { recursive: true })
      const next = subs.filter((s) => !stale.includes(s.endpoint))
      await fs.writeFile(
        STORE,
        JSON.stringify({ subscriptions: next, updatedAt: new Date().toISOString() }, null, 2),
      )
    }

    return NextResponse.json({ ok: true, sent, stale: stale.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : '푸시 전송 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
