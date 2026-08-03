'use client'

/**
 * P49 — 보안 설정 패널 (2FA · SSO 안내 · 세션 · GDPR · 감사)
 */
import { useCallback, useEffect, useState } from 'react'
import {
  KeyRound,
  LogOut,
  Shield,
  Smartphone,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  enrollTotp,
  listMfaFactors,
  unenrollTotp,
  verifyTotp,
  type MfaFactor,
} from '@/lib/auth-mfa'
import { getEnabledOAuthProviders, getSamlSetupHint, OAUTH_PROVIDER_LABELS } from '@/lib/auth-sso'
import {
  listTrackedSessions,
  pruneExpiredSessions,
  revokeAllSessions,
  revokeOtherSessions,
  type TrackedSession,
} from '@/lib/sessions'
import { executeGdprErase } from '@/lib/gdpr'
import {
  clearSecurityAudit,
  listSecurityAudit,
  subscribeSecurityAudit,
  type SecurityAuditEntry,
} from '@/lib/security-audit'
import { cn } from '@/lib/utils'

export function SecuritySettingsButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-[11px]"
        onClick={() => setOpen(true)}
      >
        <Shield className="h-3.5 w-3.5" />
        보안
      </Button>
      {open ? <SecuritySettingsPanel userId={userId} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export function SecuritySettingsPanel({
  userId,
  onClose,
}: {
  userId: string
  onClose: () => void
}) {
  const [tab, setTab] = useState<'mfa' | 'sessions' | 'audit' | 'gdpr'>('mfa')
  const [factors, setFactors] = useState<MfaFactor[]>([])
  const [enroll, setEnroll] = useState<{ factorId: string; qrCode: string; secret: string } | null>(
    null,
  )
  const [code, setCode] = useState('')
  const [sessions, setSessions] = useState<TrackedSession[]>(() => {
    pruneExpiredSessions()
    return listTrackedSessions(userId)
  })
  const [audit, setAudit] = useState<SecurityAuditEntry[]>(() => listSecurityAudit(40))
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    pruneExpiredSessions()
    setSessions(listTrackedSessions(userId))
    setAudit(listSecurityAudit(40))
    try {
      setFactors(await listMfaFactors())
    } catch {
      setFactors([])
    }
  }, [userId])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      void refresh()
    })
    return () => {
      cancelled = true
      // subscribeSecurityAudit cleanup below
    }
  }, [refresh])

  useEffect(() => subscribeSecurityAudit(() => setAudit(listSecurityAudit(40))), [])

  const providers = getEnabledOAuthProviders()

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="보안 설정"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Shield className="h-4 w-4 text-teal-600" />
          <div>
            <h2 className="text-sm font-semibold">고급 보안</h2>
            <p className="text-[11px] text-muted-foreground">2FA · 세션 · 감사 · GDPR</p>
          </div>
          <Button type="button" size="icon" variant="ghost" className="ml-auto size-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
          {(
            [
              ['mfa', '2FA'],
              ['sessions', '세션'],
              ['audit', '감사'],
              ['gdpr', 'GDPR'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs',
                tab === id ? 'bg-foreground/5 font-medium' : 'text-muted-foreground',
              )}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3 overflow-y-auto p-4 text-xs">
          {msg ? <p className="rounded-lg bg-muted/50 px-2 py-1.5 text-[11px]">{msg}</p> : null}

          {tab === 'mfa' ? (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                TOTP 앱(Google Authenticator 등)으로 2FA를 설정합니다. Supabase MFA가 켜져 있어야 합니다.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {providers.map((p) => (
                  <span key={p} className="rounded-full border px-2 py-0.5 text-[10px]">
                    SSO · {OAUTH_PROVIDER_LABELS[p]}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">{getSamlSetupHint()}</p>

              {factors.length === 0 && !enroll ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true)
                    void enrollTotp()
                      .then((r) => {
                        setEnroll({ factorId: r.factorId, qrCode: r.qrCode, secret: r.secret })
                        setMsg('QR을 스캔한 뒤 6자리 코드로 확인하세요.')
                      })
                      .catch((e: Error) => setMsg(e.message || 'MFA 등록 실패'))
                      .finally(() => setBusy(false))
                  }}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  TOTP 등록
                </Button>
              ) : null}

              {enroll ? (
                <div className="space-y-2 rounded-xl border p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enroll.qrCode} alt="TOTP QR" className="mx-auto h-40 w-40" />
                  <p className="break-all text-[10px] text-muted-foreground">secret: {enroll.secret}</p>
                  <div className="flex gap-1">
                    <input
                      className="min-w-0 flex-1 rounded-md border px-2 py-1"
                      placeholder="6자리 코드"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8"
                      disabled={busy || code.trim().length < 6}
                      onClick={() => {
                        setBusy(true)
                        void verifyTotp({ factorId: enroll.factorId, code })
                          .then(() => {
                            setEnroll(null)
                            setCode('')
                            setMsg('2FA가 활성화되었습니다.')
                            return refresh()
                          })
                          .catch((e: Error) => setMsg(e.message || '검증 실패'))
                          .finally(() => setBusy(false))
                      }}
                    >
                      확인
                    </Button>
                  </div>
                </div>
              ) : null}

              {factors.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{f.friendlyName || f.factorType}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {f.status} · {f.id.slice(0, 8)}…
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => {
                      setBusy(true)
                      void unenrollTotp(f.id)
                        .then(() => refresh())
                        .catch((e: Error) => setMsg(e.message))
                        .finally(() => setBusy(false))
                    }}
                  >
                    해제
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'sessions' ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => {
                    void revokeOtherSessions(userId)
                      .then(() => {
                        setMsg('다른 세션을 종료했습니다.')
                        return refresh()
                      })
                      .catch((e: Error) => setMsg(e.message))
                  }}
                >
                  <Users className="h-3 w-3" />
                  다른 기기 종료
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => {
                    void revokeAllSessions(userId)
                      .then(() => setMsg('모든 세션 종료 · 다시 로그인하세요.'))
                      .catch((e: Error) => setMsg(e.message))
                  }}
                >
                  <LogOut className="h-3 w-3" />
                  전체 종료
                </Button>
              </div>
              {sessions.length === 0 ? (
                <p className="text-muted-foreground">추적된 세션이 없습니다.</p>
              ) : (
                sessions.map((s) => (
                  <div key={s.id} className="rounded-lg border px-3 py-2">
                    <p className="font-medium">
                      {s.label}
                      {s.current ? ' · 현재' : ''}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      활성 {new Date(s.lastActiveAt).toLocaleString('ko-KR')}
                      {s.expiresAt ? ` · 만료 ${new Date(s.expiresAt).toLocaleString('ko-KR')}` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {tab === 'audit' ? (
            <div className="space-y-2">
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    clearSecurityAudit()
                    setAudit([])
                  }}
                >
                  로그 비우기
                </Button>
              </div>
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {audit.map((e) => (
                  <li key={e.id} className="rounded-md border px-2 py-1.5 text-[11px]">
                    <span className={e.ok ? 'text-emerald-700' : 'text-red-700'}>{e.action}</span>
                    {e.resource ? ` · ${e.resource}` : ''}
                    {e.detail ? ` · ${e.detail}` : ''}
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(e.ts).toLocaleString('ko-KR')}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tab === 'gdpr' ? (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                클라우드 데이터 삭제 · 프로필 익명화 · 로컬 저장소 정리 후 로그아웃합니다. 되돌릴 수 없습니다.
              </p>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-8 gap-1"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm('정말 모든 Folio 개인 데이터를 삭제할까요?')) return
                  setBusy(true)
                  void executeGdprErase(userId)
                    .then((r) => {
                      setMsg(
                        `삭제 완료 · 로컬 ${r.localCleared}키 · 클라우드 j${r.cloud.journals}/d${r.cloud.docs}/b${r.cloud.boards}`,
                      )
                    })
                    .catch((e: Error) => setMsg(e.message))
                    .finally(() => setBusy(false))
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                데이터 삭제 · 익명화
              </Button>
              <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
                <KeyRound className="mt-0.5 h-3 w-3 shrink-0" />
                Auth 계정 자체 삭제는 Supabase Dashboard 또는 Admin API가 필요합니다.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
