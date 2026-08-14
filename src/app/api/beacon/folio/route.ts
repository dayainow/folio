import { NextResponse } from 'next/server'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { defaultBeaconRoot, readBeaconProjectJson } from '@/lib/beacon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TYPES = new Set(['journals', 'docs', 'boards', 'projects'])

function cachePath(root: string, type: string): string {
  return path.join(root, '.beacon', 'cache', `folio-${type}.json`)
}

async function ensureBeacon(root: string): Promise<boolean> {
  const project = await readBeaconProjectJson({ root })
  return project != null
}

/** GET /api/beacon/folio?type=journals|docs|boards|projects */
export async function GET(request: Request) {
  const root = defaultBeaconRoot()
  const type = new URL(request.url).searchParams.get('type') ?? ''
  if (!TYPES.has(type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
  }
  if (!(await ensureBeacon(root))) {
    return NextResponse.json({ error: 'beacon_unavailable' }, { status: 404 })
  }
  try {
    const raw = await readFile(cachePath(root, type), 'utf8')
    const data = JSON.parse(raw) as unknown
    return NextResponse.json({ type, data })
  } catch {
    return NextResponse.json({ type, data: null })
  }
}

/** PUT /api/beacon/folio — { type, data } → `.beacon/cache/folio-*.json` */
export async function PUT(request: Request) {
  const root = defaultBeaconRoot()
  if (!(await ensureBeacon(root))) {
    return NextResponse.json({ error: 'beacon_unavailable' }, { status: 404 })
  }

  let body: { type?: string; data?: unknown }
  try {
    body = (await request.json()) as { type?: string; data?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const type = body.type ?? ''
  if (!TYPES.has(type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
  }
  if (body.data === undefined) {
    return NextResponse.json({ error: 'missing_data' }, { status: 400 })
  }

  try {
    const dir = path.join(root, '.beacon', 'cache')
    await mkdir(dir, { recursive: true })
    const file = cachePath(root, type)
    await writeFile(file, `${JSON.stringify(body.data, null, 2)}\n`, 'utf8')
    return NextResponse.json({ ok: true, type, path: `.beacon/cache/folio-${type}.json` })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'write_failed',
        message: error instanceof Error ? error.message : 'unknown',
      },
      { status: 500 },
    )
  }
}
