import { NextResponse } from 'next/server'
import { defaultBeaconRoot, readBeaconProjectJson } from '@/lib/beacon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/beacon/available — `.beacon/project.json` 존재 여부 */
export async function GET() {
  const root = defaultBeaconRoot()
  try {
    const project = await readBeaconProjectJson({ root })
    return NextResponse.json({ available: Boolean(project), root })
  } catch {
    return NextResponse.json({ available: false, root })
  }
}
