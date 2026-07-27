import { createBrowserClient, createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'

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

/** 현재 로그인 사용자 */
export async function getUser(): Promise<User | null> {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user
}

/** 로그인 필수 — user_id 필터용 */
export async function requireAuthUser() {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Supabase 로그인이 필요합니다.')
  return { supabase, user: data.user, userId: data.user.id }
}

/** 로그인 여부 (폴백 분기용) */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const user = await getUser()
    return !!user
  } catch {
    return false
  }
}

/** 이메일/비밀번호 로그인 */
export async function signIn(email: string, password: string) {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

/** 이메일/비밀번호 회원가입 */
export async function signUp(email: string, password: string) {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

/** 로그아웃 */
export async function signOut() {
  const supabase = createBrowserSupabaseClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** @deprecated 이름 호환용 — 브라우저 클라이언트를 반환 */
export const createClient = createBrowserSupabaseClient
