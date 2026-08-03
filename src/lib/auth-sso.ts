/**
 * P49 — SSO (OAuth via Supabase) · SAML은 엔터프라이즈 대시보드 설정 안내
 */
'use client'

import { createBrowserSupabaseClient } from '@/lib/supabase'
import { recordSecurityAudit } from '@/lib/security-audit'

export type OAuthProvider = 'google' | 'github' | 'azure' | 'apple' | 'gitlab' | 'bitbucket'

export const OAUTH_PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: 'Google',
  github: 'GitHub',
  azure: 'Microsoft',
  apple: 'Apple',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
}

/** env로 활성화된 OAuth 목록 (콤마 구분) */
export function getEnabledOAuthProviders(): OAuthProvider[] {
  const raw =
    process.env.NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS?.trim() ||
    process.env.NEXT_PUBLIC_SSO_PROVIDERS?.trim() ||
    'google,github'
  const allowed = new Set<string>(Object.keys(OAUTH_PROVIDER_LABELS))
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is OAuthProvider => allowed.has(s))
}

export async function signInWithOAuth(provider: OAuthProvider, redirectTo?: string): Promise<void> {
  const supabase = createBrowserSupabaseClient()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectTo ?? `${origin}/`,
      skipBrowserRedirect: false,
    },
  })
  if (error) {
    recordSecurityAudit({ action: 'auth.sso', detail: `${provider}:fail`, ok: false })
    throw error
  }
  recordSecurityAudit({ action: 'auth.sso', detail: `${provider}:start` })
}

/** SAML은 Supabase Dashboard SSO 설정 후 동일 OAuth 흐름 또는 전용 URL 사용 */
export function getSamlSetupHint(): string {
  return (
    'SAML/SSO는 Supabase Dashboard → Authentication → SSO (SAML)에서 IdP 메타데이터를 등록한 뒤 ' +
    '조직 도메인으로 로그인하세요. 셀프호스팅 시 NEXT_PUBLIC_SAML_ENTITY_ID 를 문서화합니다.'
  )
}
