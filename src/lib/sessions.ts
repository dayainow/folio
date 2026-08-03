/**
 * P49 — 세션 관리 (다중 세션 추적 · 만료 · 원격 로그아웃)
 */
'use client'

import { createBrowserSupabaseClient } from '@/lib/supabase'
import { recordSecurityAudit } from '@/lib/security-audit'

export type TrackedSession = {
  id: string
  userId: string
  createdAt: string
  lastActiveAt: string
  userAgent: string
  label: string
  current: boolean
  expiresAt: string | null
}

const KEY = 'folio_sessions_v1'
const DEFAULT_TTL_MS = 14 * 86400_000 // 14일

function readAll(): TrackedSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as TrackedSession[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(items: TrackedSession[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

function deviceLabel(ua: string): string {
  if (/iPhone|iPad/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Mac OS/i.test(ua)) return 'macOS'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Browser'
}

/** 로그인 직후 현재 세션 등록 */
export async function trackCurrentSession(userId: string): Promise<TrackedSession | null> {
  if (typeof window === 'undefined') return null
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session) return null

  const id = session.access_token.slice(-24)
  const now = new Date().toISOString()
  const ua = navigator.userAgent
  const expiresAt = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : new Date(Date.now() + DEFAULT_TTL_MS).toISOString()

  const next: TrackedSession = {
    id,
    userId,
    createdAt: now,
    lastActiveAt: now,
    userAgent: ua.slice(0, 180),
    label: deviceLabel(ua),
    current: true,
    expiresAt,
  }

  const others = readAll()
    .filter((s) => s.userId === userId && s.id !== id)
    .map((s) => ({ ...s, current: false }))
  writeAll([next, ...others].slice(0, 20))
  return next
}

export function listTrackedSessions(userId: string): TrackedSession[] {
  const now = Date.now()
  return readAll()
    .filter((s) => s.userId === userId)
    .filter((s) => !s.expiresAt || Date.parse(s.expiresAt) > now)
    .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
}

export function touchCurrentSession(userId: string): void {
  const all = readAll()
  const now = new Date().toISOString()
  writeAll(
    all.map((s) =>
      s.userId === userId && s.current ? { ...s, lastActiveAt: now } : s,
    ),
  )
}

/** 현재 기기만 로그아웃 */
export async function revokeLocalSession(userId?: string): Promise<void> {
  const supabase = createBrowserSupabaseClient()
  await supabase.auth.signOut({ scope: 'local' })
  if (userId) {
    writeAll(readAll().filter((s) => !(s.userId === userId && s.current)))
  }
  recordSecurityAudit({
    userId,
    action: 'auth.session_revoke',
    detail: 'local',
  })
}

/** 다른 기기 세션 원격 종료 */
export async function revokeOtherSessions(userId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient()
  await supabase.auth.signOut({ scope: 'others' })
  writeAll(readAll().filter((s) => !(s.userId === userId && !s.current)))
  recordSecurityAudit({
    userId,
    action: 'auth.session_revoke',
    detail: 'others',
  })
}

/** 모든 세션 종료 */
export async function revokeAllSessions(userId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient()
  await supabase.auth.signOut({ scope: 'global' })
  writeAll(readAll().filter((s) => s.userId !== userId))
  recordSecurityAudit({
    userId,
    action: 'auth.session_revoke',
    detail: 'global',
  })
}

/** 만료된 추적 세션 정리 */
export function pruneExpiredSessions(): number {
  const before = readAll()
  const now = Date.now()
  const next = before.filter((s) => !s.expiresAt || Date.parse(s.expiresAt) > now)
  writeAll(next)
  return before.length - next.length
}
