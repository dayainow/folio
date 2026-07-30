import { NextResponse } from 'next/server'
import { exportDocAsBeaconArtifact, type ConflictStrategy } from '@/lib/beacon-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/beacon/artifacts — Docs → Beacon artifact export */
export async function POST(request: Request) {
  let body: {
    title?: string
    content?: string
    category?: string
    docId?: string
    expectedMtime?: number | null
    strategy?: ConflictStrategy
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

  const result = await exportDocAsBeaconArtifact({
    title,
    content: body.content ?? '',
    category: body.category?.trim() || 'Docs',
    docId: body.docId,
    expectedMtime: body.expectedMtime,
    strategy: body.strategy,
  })

  if (!result.ok && 'conflict' in result && result.conflict) {
    return NextResponse.json(result, { status: 409 })
  }
  if (!result.ok) {
    return NextResponse.json(result, { status: result.message === 'beacon_unavailable' ? 404 : 400 })
  }
  return NextResponse.json(result)
}
