import { NextResponse } from 'next/server'
import {
  createFolioBeaconSnapshot,
  defaultBeaconRoot,
  listFolioBeaconSnapshots,
  type FolioBeaconSnapshotSource,
} from '@/lib/beacon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/beacon/snapshots — Folio 스냅샷 목록 */
export async function GET() {
  const root = defaultBeaconRoot()
  const snapshots = await listFolioBeaconSnapshots(root)
  return NextResponse.json({ snapshots })
}

/** POST /api/beacon/snapshots — { source?: auto|manual|change } */
export async function POST(request: Request) {
  const root = defaultBeaconRoot()
  let source: FolioBeaconSnapshotSource = 'manual'
  try {
    const body = (await request.json()) as { source?: FolioBeaconSnapshotSource }
    if (body.source === 'auto' || body.source === 'manual' || body.source === 'change') {
      source = body.source
    }
  } catch {
    /* empty body ok */
  }

  const snapshot = await createFolioBeaconSnapshot({ root, source })
  if (!snapshot) {
    return NextResponse.json(
      { error: 'beacon_unavailable', message: 'Beacon이 없거나 스냅샷을 만들 수 없습니다.' },
      { status: 404 },
    )
  }
  return NextResponse.json({ ok: true, snapshot })
}
