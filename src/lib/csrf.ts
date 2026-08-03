/**
 * P49 — CSRF 더블 서브밋 쿠키
 */
export const CSRF_COOKIE = 'folio_csrf'
export const CSRF_HEADER = 'x-folio-csrf'

export function createCsrfToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `csrf_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function parseCookieHeader(header: string | null, name: string): string | null {
  if (!header) return null
  const parts = header.split(';')
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('=') || '')
  }
  return null
}

/** 메서드·쿠키·헤더 값으로 CSRF 검증 (테스트·미들웨어 공통) */
export function verifyCsrfTokens(
  method: string,
  cookie: string | null | undefined,
  header: string | null | undefined,
): { ok: boolean; reason?: string } {
  const m = method.toUpperCase()
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') {
    return { ok: true }
  }
  if (!cookie || !header) return { ok: false, reason: 'missing_csrf' }
  if (cookie !== header) return { ok: false, reason: 'mismatch' }
  return { ok: true }
}

/** 변경 요청(POST/PUT/PATCH/DELETE)에서 쿠키↔헤더 일치 확인 */
export function verifyCsrf(request: Request): { ok: boolean; reason?: string } {
  return verifyCsrfTokens(
    request.method,
    parseCookieHeader(request.headers.get('cookie'), CSRF_COOKIE),
    request.headers.get(CSRF_HEADER),
  )
}

/** 클라이언트: fetch 래퍼용 헤더 */
export function csrfHeaders(): HeadersInit {
  if (typeof document === 'undefined') return {}
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`))
  const token = match ? decodeURIComponent(match[1]!) : ''
  if (!token) return {}
  return { [CSRF_HEADER]: token }
}

/** CSRF 헤더를 합친 fetch — 타이밍은 timed-fetch 권장 */
export async function csrfFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // 순환 의존 방지: 동적 import
  const { timedFetch } = await import('@/lib/timed-fetch')
  return timedFetch(input, init)
}
