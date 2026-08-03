/**
 * P49 — GDPR / 개인정보: 로컬·클라우드 데이터 삭제 · 익명화
 */
'use client'

import { createBrowserSupabaseClient } from '@/lib/supabase'
import { recordSecurityAudit, SECURITY_AUDIT_KEY } from '@/lib/security-audit'

const LOCAL_KEYS_PREFIXES = [
  'workspace_',
  'folio_',
  'supabase:',
]

/** 브라우저에 남은 Folio 관련 키 목록 */
export function listFolioLocalKeys(): string[] {
  if (typeof window === 'undefined') return []
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i)
    if (!k) continue
    if (LOCAL_KEYS_PREFIXES.some((p) => k.startsWith(p))) keys.push(k)
  }
  return keys.sort()
}

export async function clearLocalFolioData(opts?: { keepSecurityAudit?: boolean }): Promise<number> {
  const keys = listFolioLocalKeys()
  let n = 0
  for (const k of keys) {
    if (opts?.keepSecurityAudit && k === SECURITY_AUDIT_KEY) continue
    try {
      localStorage.removeItem(k)
      n += 1
    } catch {
      /* ignore */
    }
  }
  try {
    sessionStorage.clear()
  } catch {
    /* ignore */
  }
  return n
}

/**
 * Supabase 사용자 데이터 삭제 (journals/docs/boards — RLS 범위)
 * Auth 계정 삭제는 Dashboard/Admin API 필요 — 안내만
 */
export async function deleteCloudUserData(userId: string): Promise<{
  journals: number
  docs: number
  boards: number
}> {
  const supabase = createBrowserSupabaseClient()
  const counts = { journals: 0, docs: 0, boards: 0 }

  const tables = [
    ['journals', 'journals'],
    ['docs', 'docs'],
    ['boards', 'boards'],
  ] as const

  for (const [table, key] of tables) {
    try {
      const { data, error } = await supabase.from(table).delete().eq('user_id', userId).select('id')
      if (!error && data) {
        counts[key] = data.length
      }
    } catch {
      /* 테이블 미존재 등 */
    }
  }

  recordSecurityAudit({
    userId,
    action: 'gdpr.delete',
    detail: `cloud j=${counts.journals} d=${counts.docs} b=${counts.boards}`,
  })
  return counts
}

/** 표시명/이메일을 익명화한 메타데이터 패치 (가능 시) */
export async function anonymizeUserProfile(userId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient()
  const anon = `anon_${userId.slice(0, 8)}`
  try {
    await supabase.auth.updateUser({
      data: {
        full_name: anon,
        name: anon,
        avatar_url: null,
        folio_anonymized_at: new Date().toISOString(),
      },
    })
  } catch {
    /* ignore */
  }
  recordSecurityAudit({
    userId,
    action: 'gdpr.anonymize',
    detail: anon,
  })
}

/** 원클릭: 클라우드 삭제 + 로컬 정리 + 익명화 + 로그아웃 */
export async function executeGdprErase(userId: string): Promise<{
  localCleared: number
  cloud: { journals: number; docs: number; boards: number }
}> {
  const cloud = await deleteCloudUserData(userId)
  await anonymizeUserProfile(userId)
  const localCleared = await clearLocalFolioData({ keepSecurityAudit: true })
  recordSecurityAudit({
    userId,
    action: 'gdpr.delete',
    detail: `full local=${localCleared}`,
  })
  try {
    await supabaseSignOutSafe()
  } catch {
    /* ignore */
  }
  return { localCleared, cloud }
}

async function supabaseSignOutSafe() {
  const supabase = createBrowserSupabaseClient()
  await supabase.auth.signOut({ scope: 'local' })
}
