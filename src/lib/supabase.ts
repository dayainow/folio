import { createBrowserClient, createServerClient } from '@supabase/ssr'

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Supabase env가 없습니다. NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 .env.local에 설정하세요.',
    )
  }

  return { url, anonKey }
}

/** 브라우저 / 클라이언트 컴포넌트용 Supabase 클라이언트 */
export function createBrowserSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv()
  return createBrowserClient(url, anonKey)
}

/**
 * 서버 컴포넌트용 Supabase 클라이언트 (cookies 기반)
 * next/headers는 서버에서만 동적으로 로드한다.
 */
export async function createServerSupabaseClient() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const { url, anonKey } = getSupabaseEnv()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Component에서 호출된 경우 set이 막힐 수 있음 (미들웨어에서 세션 갱신 권장)
        }
      },
    },
  })
}

/** @deprecated 이름 호환용 — 브라우저 클라이언트를 반환 */
export const createClient = createBrowserSupabaseClient
