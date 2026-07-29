import { NextResponse } from 'next/server'
import { defaultBeaconRoot, getBeaconFileMtimes } from '@/lib/beacon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/beacon/mtime — project.json / beacon.db lastModified */
export async function GET() {
  const root = defaultBeaconRoot()
  const mtimes = await getBeaconFileMtimes(root)
  return NextResponse.json(mtimes)
}
