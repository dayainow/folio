'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { getEnabledOAuthProviders } from '@/lib/auth-sso'
import { recordSecurityAudit } from '@/lib/security-audit'

type AuthView = 'sign_in' | 'sign_up' | 'forgotten_password'

export default function LoginPage() {
  const router = useRouter()
  const [view, setView] = useState<AuthView>('sign_in')

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient()
    } catch {
      return null
    }
  }, [])

  const envError = supabase
    ? null
    : 'Supabase env가 설정되지 않았습니다. .env.local을 확인하세요.'

  const [ready, setReady] = useState(() => !supabase)

  useEffect(() => {
    if (!supabase) return

    let cancelled = false

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (data.session) {
        router.replace('/')
        return
      }
      setReady(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        recordSecurityAudit({
          userId: session?.user?.id,
          action: 'auth.login',
          detail: 'password_or_sso',
        })
        void import('@/lib/sessions').then(({ trackCurrentSession }) => {
          if (session?.user?.id) void trackCurrentSession(session.user.id)
        })
        router.replace('/')
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase, router])

  const tabs: { id: AuthView; label: string }[] = [
    { id: 'sign_in', label: '로그인' },
    { id: 'sign_up', label: '회원가입' },
    { id: 'forgotten_password', label: '비밀번호 재설정' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur">
        <Link href="/" className="flex flex-col leading-none">
          <span className="relative inline-block text-[22px] font-bold tracking-[-0.07em] text-gray-900">
            Folio
            <span
              aria-hidden
              className="absolute -right-2 top-0.5 h-1.5 w-1.5 rotate-45 rounded-[1px] bg-gray-900"
            />
          </span>
          <span className="mt-1 text-[10px] font-medium tracking-[0.18em] text-gray-400">
            project records
          </span>
        </Link>
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-800">
          ← 워크스페이스로
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-lg font-semibold text-gray-900 tracking-tight">계정</h1>
            <p className="mt-1 text-xs text-gray-400">프로젝트의 기록을 동기화하려면 로그인하세요</p>
          </div>

          <div className="mb-5 flex gap-1 rounded-xl bg-gray-50 p-1 border border-gray-100">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                  view === tab.id
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {!ready ? (
            <p className="text-center text-xs text-gray-400 py-8">불러오는 중…</p>
          ) : envError || !supabase ? (
            <div className="rounded-xl bg-red-50 text-red-600 text-xs p-4 leading-relaxed">
              {envError ?? 'Supabase 클라이언트를 만들 수 없습니다.'}
            </div>
          ) : (
            <Auth
              key={view}
              supabaseClient={supabase}
              view={view}
              providers={getEnabledOAuthProviders()}
              redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/` : undefined}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#111827',
                      brandAccent: '#374151',
                      inputBackground: 'white',
                      inputBorder: '#e5e7eb',
                      inputBorderFocus: '#111827',
                      inputBorderHover: '#d1d5db',
                    },
                    radii: {
                      borderRadiusButton: '10px',
                      buttonBorderRadius: '10px',
                      inputBorderRadius: '10px',
                    },
                  },
                },
                className: {
                  container: 'folio-auth',
                  button: 'font-medium',
                  label: 'text-xs text-gray-600',
                  input: 'text-sm',
                  message: 'text-xs',
                },
              }}
              localization={{
                variables: {
                  sign_in: {
                    email_label: '이메일',
                    password_label: '비밀번호',
                    button_label: '로그인',
                    loading_button_label: '로그인 중…',
                    social_provider_text: '{{provider}}로 계속',
                    link_text: '이미 계정이 있나요? 로그인',
                  },
                  sign_up: {
                    email_label: '이메일',
                    password_label: '비밀번호',
                    button_label: '회원가입',
                    loading_button_label: '가입 중…',
                    social_provider_text: '{{provider}}로 계속',
                    link_text: '계정이 없나요? 회원가입',
                  },
                  forgotten_password: {
                    email_label: '이메일',
                    button_label: '재설정 메일 보내기',
                    loading_button_label: '전송 중…',
                    link_text: '비밀번호를 잊으셨나요?',
                  },
                },
              }}
              showLinks={false}
            />
          )}
        </div>
      </main>
    </div>
  )
}
