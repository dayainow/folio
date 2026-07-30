import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  buildBeaconViewModel,
  defaultBeaconRoot,
  readBeaconDb,
  readBeaconProjectJson,
  type BeaconViewModel,
} from '@/lib/beacon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function readFallbackName(root: string): Promise<string | undefined> {
  try {
    const raw = await readFile(path.join(root, 'package.json'), 'utf8')
    const pkg = JSON.parse(raw) as { name?: unknown }
    return typeof pkg.name === 'string' && pkg.name.trim() ? pkg.name.trim() : undefined
  } catch {
    return undefined
  }
}

/** GET /api/beacon/summary — 로컬 `.beacon` 읽기 전용 요약 */
export async function GET() {
  const root = defaultBeaconRoot()
  try {
    const project = await readBeaconProjectJson({ root })
    if (!project) {
      const empty: BeaconViewModel = {
        available: false,
        project: null,
        summary: null,
        timeline: [],
        artifacts: [],
        message: 'Beacon 프로젝트를 초기화하세요',
        source: 'none',
      }
      return NextResponse.json(empty)
    }

    const db = await readBeaconDb({ root })
    const fallbackName = await readFallbackName(root)
    const { readFolioTimelineEvents } = await import('@/lib/beacon-sync')
    const folioTimeline = await readFolioTimelineEvents(root)
    const view = buildBeaconViewModel({
      project,
      db,
      fallbackName,
      source: 'server',
      folioTimeline,
    })
    const mtimes = await import('@/lib/beacon').then((m) => m.getBeaconFileMtimes(root))
    return NextResponse.json({ ...view, projectMtime: mtimes.projectJson })
  } catch (error) {
    return NextResponse.json(
      {
        available: false,
        project: null,
        summary: null,
        timeline: [],
        artifacts: [],
        message: error instanceof Error ? error.message : 'Beacon 읽기 실패',
        source: 'none',
      } satisfies BeaconViewModel,
      { status: 200 },
    )
  }
}
