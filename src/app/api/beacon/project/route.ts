import { NextResponse } from 'next/server'
import { defaultBeaconRoot, getBeaconFileMtimes, readBeaconProjectJson } from '@/lib/beacon'
import { writeBeaconProjectOverlay, type ConflictStrategy } from '@/lib/beacon-sync'
import type { FolioGateOverlay, ProcessStageId } from '@/lib/beacon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/beacon/project — project.json + mtime */
export async function GET() {
  const root = defaultBeaconRoot()
  const project = await readBeaconProjectJson({ root })
  if (!project) {
    return NextResponse.json({ error: 'beacon_unavailable' }, { status: 404 })
  }
  const mtimes = await getBeaconFileMtimes(root)
  return NextResponse.json({ project, mtime: mtimes.projectJson })
}

/** PUT /api/beacon/project — Folio overlay append-only 저장 */
export async function PUT(request: Request) {
  const root = defaultBeaconRoot()
  let body: {
    expectedMtime?: number | null
    strategy?: ConflictStrategy
    name?: string
    gates?: Partial<Record<ProcessStageId, FolioGateOverlay>>
    artifacts?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const result = await writeBeaconProjectOverlay(
    {
      expectedMtime: body.expectedMtime ?? null,
      strategy: body.strategy,
      name: body.name,
      gates: body.gates,
      artifacts: Array.isArray(body.artifacts) ? (body.artifacts as never) : undefined,
    },
    root,
  )

  if (!result.ok && result.conflict) {
    return NextResponse.json(result, { status: 409 })
  }
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 })
  }
  return NextResponse.json(result)
}
