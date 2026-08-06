import { NextResponse } from 'next/server'
import { listEnvChecks, validateSupabasePublicEnv } from '@/lib/env-config'

/** 프로세스 시작 시각 (Docker/standalone 수명 · 서버리스는 인스턴스 수명) */
const startedAt = Date.now()

const VERSION =
  process.env.npm_package_version ??
  process.env.FOLIO_VERSION ??
  '3.8.0'

/**
 * GET /api/health
 * 로드밸런서 · Docker HEALTHCHECK · 업타임 모니터링용
 */
export async function GET() {
  const uptimeSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  const supabase = validateSupabasePublicEnv()
  const envConfigured = listEnvChecks().filter((c) => c.present).length

  return NextResponse.json(
    {
      status: 'ok' as const,
      version: VERSION,
      uptime: uptimeSec,
      timestamp: new Date().toISOString(),
      env: {
        supabaseReady: supabase.ok,
        configuredCount: envConfigured,
        ...(supabase.ok ? {} : { supabaseHint: supabase.message }),
      },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
