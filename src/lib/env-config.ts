/**
 * v2.0 — 환경변수/설정 검증 (서버·부트스트랩용)
 */

export type EnvCheck = {
  key: string
  required: boolean
  present: boolean
  hint?: string
}

const PUBLIC_OPTIONAL = [
  'NEXT_PUBLIC_FOLIO_URL',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

const SERVER_OPTIONAL = [
  'FOLIO_VERSION',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'JIRA_API_TOKEN',
  'JIRA_EMAIL',
  'JIRA_DOMAIN',
  'JIRA_PROJECT_KEY',
  'SLACK_WEBHOOK_URL',
  'DISCORD_WEBHOOK_URL',
  'GITHUB_TOKEN',
  'GITHUB_REPO',
  'GITHUB_WEBHOOK_SECRET',
  'BEACON_PROJECT_ROOT',
  'FOLIO_MCP_WEBHOOK_SECRET',
  'AUDIT_LOG_RETENTION_DAYS',
  'STORAGE_ALERT_THRESHOLD',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'FOLIO_AI_PROVIDER',
  'FOLIO_AI_MODEL',
] as const

function hasValue(key: string): boolean {
  const v = process.env[key]
  if (v == null || !String(v).trim()) return false
  const lower = String(v).toLowerCase()
  if (lower.includes('placeholder') || lower.includes('your-') || lower === 'example') return false
  return true
}

/** 클라우드 모드에 필요한 공개 Supabase 키 쌍 */
export function validateSupabasePublicEnv(): { ok: boolean; missing: string[]; message?: string } {
  const url = hasValue('NEXT_PUBLIC_SUPABASE_URL')
  const anon = hasValue('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const missing: string[] = []
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!anon) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (missing.length === 0) return { ok: true, missing: [] }
  return {
    ok: false,
    missing,
    message: `Supabase 설정이 불완전합니다. 누락: ${missing.join(', ')}. docs/env.example 을 참고하세요.`,
  }
}

export function listEnvChecks(): EnvCheck[] {
  const checks: EnvCheck[] = []
  for (const key of PUBLIC_OPTIONAL) {
    checks.push({
      key,
      required: false,
      present: hasValue(key),
      hint: key.startsWith('NEXT_PUBLIC_SUPABASE')
        ? '클라우드 저장·Auth에 필요'
        : undefined,
    })
  }
  for (const key of SERVER_OPTIONAL) {
    checks.push({ key, required: false, present: hasValue(key) })
  }
  return checks
}

/** 부팅 시 경고 문자열 (필수 누락이 있을 때만 throw용 메시지 생성) */
export function formatEnvValidationError(missingRequired: string[]): string {
  return [
    '[Folio] 필수 환경변수가 없습니다.',
    ...missingRequired.map((k) => `  - ${k}`),
    '템플릿: docs/env.example → .env.local',
  ].join('\n')
}
