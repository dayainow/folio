import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const startedAt = Date.now()

function isSet(value: string | undefined): boolean {
  if (!value) return false
  const v = value.trim().toLowerCase()
  if (!v) return false
  return !(
    v.startsWith('your-') ||
    v.includes('placeholder') ||
    v === 'ci-anon-key-placeholder' ||
    v.includes('example.supabase')
  )
}

async function readPackageMeta(): Promise<{ version: string; nextVersion: string | null }> {
  try {
    const raw = await readFile(path.join(process.cwd(), 'package.json'), 'utf8')
    const pkg = JSON.parse(raw) as {
      version?: string
      dependencies?: Record<string, string>
    }
    const nextRaw = pkg.dependencies?.next ?? null
    return {
      version: pkg.version ?? process.env.FOLIO_VERSION ?? '0.0.0',
      nextVersion: nextRaw,
    }
  } catch {
    return {
      version: process.env.npm_package_version ?? process.env.FOLIO_VERSION ?? '0.0.0',
      nextVersion: null,
    }
  }
}

/**
 * GET /api/runtime
 * 실행 환경 요약 — 시크릿 값은 노출하지 않고 설정 여부만 반환
 */
export async function GET() {
  const { version, nextVersion } = await readPackageMeta()
  const uptimeSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))

  const auditLogRetentionDays = (() => {
    const n = Number(process.env.AUDIT_LOG_RETENTION_DAYS ?? process.env.NEXT_PUBLIC_AUDIT_LOG_RETENTION_DAYS)
    if (!Number.isFinite(n) || n < 1) return 30
    return Math.min(365, Math.floor(n))
  })()
  const storageAlertThreshold = (() => {
    const n = Number(process.env.STORAGE_ALERT_THRESHOLD ?? process.env.NEXT_PUBLIC_STORAGE_ALERT_THRESHOLD)
    if (!Number.isFinite(n) || n < 1) return 3
    return Math.min(50, Math.floor(n))
  })()

  const env = {
    supabase: isSet(process.env.NEXT_PUBLIC_SUPABASE_URL) && isSet(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    jira:
      isSet(process.env.JIRA_API_TOKEN) &&
      isSet(process.env.JIRA_EMAIL) &&
      isSet(process.env.JIRA_DOMAIN),
    slack: isSet(process.env.SLACK_WEBHOOK_URL),
    discord: isSet(process.env.DISCORD_WEBHOOK_URL),
    github: isSet(process.env.GITHUB_TOKEN) && isSet(process.env.GITHUB_REPO),
    beaconRoot: isSet(process.env.BEACON_PROJECT_ROOT),
    folioVersionEnv: isSet(process.env.FOLIO_VERSION),
    auditLogRetentionDays: isSet(process.env.AUDIT_LOG_RETENTION_DAYS) || isSet(process.env.NEXT_PUBLIC_AUDIT_LOG_RETENTION_DAYS),
    storageAlertThreshold: isSet(process.env.STORAGE_ALERT_THRESHOLD) || isSet(process.env.NEXT_PUBLIC_STORAGE_ALERT_THRESHOLD),
  }

  return NextResponse.json(
    {
      status: 'ok' as const,
      version,
      folioVersion: process.env.FOLIO_VERSION ?? version,
      nodeVersion: process.version,
      nextVersion,
      nodeEnv: process.env.NODE_ENV ?? 'unknown',
      platform: process.platform,
      uptime: uptimeSec,
      auditLogRetentionDays,
      storageAlertThreshold,
      env,
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
