/**
 * P49 — 세션 쿠키 갱신 + CSRF 쿠키 발급 + API CSRF 검증
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createCsrfToken, CSRF_COOKIE, CSRF_HEADER, verifyCsrfTokens } from '@/lib/csrf'
import {
  canUseLocalSensitiveApis,
  hasValidApiBearer,
  isSensitiveApiPath,
} from '@/lib/sensitive-api-auth'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  })
  const sensitiveApi = isSensitiveApiPath(request.nextUrl.pathname)
  const apiSecret = process.env.FOLIO_API_SECRET?.trim()
  const bearerAuthenticated = sensitiveApi
    ? await hasValidApiBearer(request, apiSecret)
    : false

  // CSRF 쿠키 보장
  if (!request.cookies.get(CSRF_COOKIE)?.value) {
    response.cookies.set(CSRF_COOKIE, createCsrfToken(), {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    })
  }

  // API 변경 요청 CSRF
  if (request.nextUrl.pathname.startsWith('/api/') && MUTATING.has(request.method)) {
    // 웹훅·헬스·공개 콜백은 제외
    const skip =
      request.nextUrl.pathname.startsWith('/api/github/webhook') ||
      request.nextUrl.pathname.startsWith('/api/mcp/') ||
      request.nextUrl.pathname.startsWith('/api/health') ||
      request.nextUrl.pathname.startsWith('/api/runtime')
    if (!skip && !bearerAuthenticated) {
      const check = verifyCsrfTokens(
        request.method,
        request.cookies.get(CSRF_COOKIE)?.value,
        request.headers.get(CSRF_HEADER),
      )
      if (!check.ok) {
        return NextResponse.json(
          { error: 'csrf_failed', reason: check.reason },
          { status: 403 },
        )
      }
    }
  }

  // Supabase 세션 갱신 (env 있을 때만)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseConfigured = Boolean(
    url &&
    anon &&
    !url.includes('placeholder') &&
    !url.includes('your-') &&
    !anon.includes('your-'),
  )
  let sessionAuthenticated = false
  if (supabaseConfigured) {
    try {
      const supabase = createServerClient(url!, anon!, {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      })
      const { data } = await supabase.auth.getUser()
      sessionAuthenticated = Boolean(data.user)
    } catch {
      /* env/네트워크 실패 무시 */
    }
  }

  if (sensitiveApi && !bearerAuthenticated && !sessionAuthenticated) {
    if (
      canUseLocalSensitiveApis({
        requestUrl: request.url,
        nodeEnv: process.env.NODE_ENV,
        allowProductionLoopback: process.env.FOLIO_ALLOW_LOCAL_API === '1',
        apiSecretConfigured: Boolean(apiSecret),
        supabaseConfigured,
      })
    ) {
      return response
    }

    const authConfigured = Boolean(apiSecret) || supabaseConfigured
    return NextResponse.json(
      { error: authConfigured ? 'authentication_required' : 'api_auth_not_configured' },
      {
        status: authConfigured ? 401 : 503,
        headers: authConfigured ? { 'WWW-Authenticate': 'Bearer' } : undefined,
      },
    )
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|screenshots/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
