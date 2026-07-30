import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'

type PushSubscriptionJSON = {
  endpoint: string
  keys?: { p256dh?: string; auth?: string }
  expirationTime?: number | null
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

async function writeSubs(subs: PushSubscriptionJSON[]): Promise<void> {
  await fs.mkdir(path.dirname(STORE), { recursive: true })
  await fs.writeFile(STORE, JSON.stringify({ subscriptions: subs, updatedAt: new Date().toISOString() }, null, 2))
}

/** POST /api/push/subscribe — 브라우저 PushSubscription 등록 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { subscription?: PushSubscriptionJSON }
    const sub = body.subscription
    if (!sub?.endpoint) {
      return NextResponse.json({ error: 'subscription.endpoint가 필요합니다.' }, { status: 400 })
    }
    const existing = await readSubs()
    const next = existing.filter((s) => s.endpoint !== sub.endpoint)
    next.push(sub)
    await writeSubs(next.slice(-50))
    return NextResponse.json({ ok: true, count: next.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : '구독 저장 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE /api/push/subscribe — 구독 해제 */
export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { endpoint?: string }
    if (!body.endpoint) {
      return NextResponse.json({ error: 'endpoint가 필요합니다.' }, { status: 400 })
    }
    const existing = await readSubs()
    const next = existing.filter((s) => s.endpoint !== body.endpoint)
    await writeSubs(next)
    return NextResponse.json({ ok: true, count: next.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : '구독 삭제 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
