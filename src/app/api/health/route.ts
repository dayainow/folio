import { NextResponse } from 'next/server'

/** 프로세스 시작 시각 (Docker/standalone 수명 · 서버리스는 인스턴스 수명) */
const startedAt = Date.now()

const VERSION =
  process.env.npm_package_version ??
  process.env.FOLIO_VERSION ??
  '1.5.0-wip'

/**
 * GET /api/health
 * 로드밸런서 · Docker HEALTHCHECK · 업타임 모니터링용
 */
export async function GET() {
  const uptimeSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))

  return NextResponse.json(
    {
      status: 'ok' as const,
      version: VERSION,
      uptime: uptimeSec,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
