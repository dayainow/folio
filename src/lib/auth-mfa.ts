/**
 * P49 — Supabase MFA (TOTP) 헬퍼
 */
'use client'

import { createBrowserSupabaseClient } from '@/lib/supabase'
import { recordSecurityAudit } from '@/lib/security-audit'

export type MfaFactor = {
  id: string
  friendlyName?: string
  factorType: string
  status: string
}

export async function listMfaFactors(): Promise<MfaFactor[]> {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  return (data.totp ?? []).map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? undefined,
    factorType: f.factor_type,
    status: f.status,
  }))
}

/** TOTP 등록 시작 — QR/secret 반환 */
export async function enrollTotp(friendlyName = 'Folio'): Promise<{
  factorId: string
  qrCode: string
  secret: string
  uri: string
}> {
  const supabase = createBrowserSupabaseClient()
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  })
  if (error) throw error
  recordSecurityAudit({
    userId: userData.user?.id,
    action: 'auth.mfa',
    detail: 'enroll_start',
  })
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  }
}

/** 등록 확인 또는 로그인 챌린지 검증 */
export async function verifyTotp(input: {
  factorId: string
  code: string
  challengeId?: string
}): Promise<void> {
  const supabase = createBrowserSupabaseClient()
  const { data: userData } = await supabase.auth.getUser()

  let challengeId = input.challengeId
  if (!challengeId) {
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: input.factorId,
    })
    if (chErr) throw chErr
    challengeId = ch.id
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId: input.factorId,
    challengeId,
    code: input.code.trim(),
  })
  if (error) {
    recordSecurityAudit({
      userId: userData.user?.id,
      action: 'auth.mfa',
      detail: 'verify_fail',
      ok: false,
    })
    throw error
  }
  recordSecurityAudit({
    userId: userData.user?.id,
    action: 'auth.mfa',
    detail: 'verify_ok',
  })
}

export async function unenrollTotp(factorId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient()
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw error
  recordSecurityAudit({
    userId: userData.user?.id,
    action: 'auth.mfa',
    detail: `unenroll:${factorId}`,
  })
}

/** AAL 수준 — MFA 필요 여부 */
export async function getAuthenticatorAssuranceLevel(): Promise<{
  currentLevel: string | null
  nextLevel: string | null
  currentAuthenticationMethods: unknown[]
}> {
  const supabase = createBrowserSupabaseClient()
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw error
  return {
    currentLevel: data.currentLevel,
    nextLevel: data.nextLevel,
    currentAuthenticationMethods: data.currentAuthenticationMethods ?? [],
  }
}
