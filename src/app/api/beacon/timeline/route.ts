import { NextResponse } from 'next/server'
import { defaultBeaconRoot } from '@/lib/beacon'
import { appendFolioTimelineEvent, readFolioTimelineEvents } from '@/lib/beacon-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/beacon/timeline — Folio append-only timeline */
export async function GET() {
  const root = defaultBeaconRoot()
  const events = await readFolioTimelineEvents(root)
  return NextResponse.json({ events })
}

/** POST /api/beacon/timeline — Folio 이벤트 append */
export async function POST(request: Request) {
  let body: {
    title?: string
    detail?: string
    category?: string
    type?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const title = body.title?.trim()
  if (!title) {
    return NextResponse.json({ error: 'title_required' }, { status: 400 })
  }

  const root = defaultBeaconRoot()
  const event = await appendFolioTimelineEvent(
    {
      title,
      detail: body.detail ?? '',
      category: body.category ?? 'folio',
      type: body.type ?? 'folio',
      source: 'folio',
    },
    root,
  )

  if (!event) {
    return NextResponse.json({ error: 'write_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, event })
}
