import { NextResponse } from 'next/server'
import { defaultBeaconRoot, readFolioBeaconSnapshot } from '@/lib/beacon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** GET /api/beacon/snapshots/[id] */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const root = defaultBeaconRoot()
  const snapshot = await readFolioBeaconSnapshot(id, root)
  if (!snapshot) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ snapshot })
}
