/**
 * P47 — 저장 관측 감사 로그 (localStorage)
 * 저장/변경 이벤트 · 모드별 성공/실패 · 보존 기간 · 연속 실패 추적
 */
'use client'

import type { StorageDataType, StorageMode } from '@/lib/storage'

export type AuditStatus = 'success' | 'failure' | 'fallback' | 'retry'

export type AuditAction = 'save' | 'load' | 'integrity' | 'retry' | 'alert'

export type AuditLogEntry = {
  id: string
  /** ISO 시각 */
  ts: string
  user: string
  mode: StorageMode
  type: StorageDataType | string
  action: AuditAction
  /** 변경 내용 요약 */
  change: string
  status: AuditStatus
  /** 페이로드 대략 크기 (bytes) */
  size?: number
  /** 소요 시간 (ms) */
  durationMs?: number
  error?: string
  attempt?: number
}

export type StorageObservabilityStats = {
  total: number
  success: number
  failure: number
  fallback: number
  successRate: number
  avgDurationMs: number
  byMode: Record<StorageMode, { total: number; success: number; failure: number; avgDurationMs: number }>
  failureReasons: Array<{ reason: string; count: number }>
  hourly: Array<{ hour: string; success: number; failure: number; total: number }>
  consecutiveFailures: number
  retentionDays: number
  alertThreshold: number
}

const LOG_KEY = 'folio_audit_log'
const STREAK_KEY = 'folio_save_fail_streak'
const CONFIG_CACHE_KEY = 'folio_audit_config'
const EVENT = 'folio-audit-log'
const DEFAULT_RETENTION_DAYS = 30
const DEFAULT_ALERT_THRESHOLD = 3
const MAX_ENTRIES = 2000

let cachedUser = 'guest'
let retentionDays = DEFAULT_RETENTION_DAYS
let alertThreshold = DEFAULT_ALERT_THRESHOLD

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `a_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function parseDays(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(365, Math.floor(n))
}

function parseThreshold(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(50, Math.floor(n))
}

/** 클라이언트 기본값 (NEXT_PUBLIC_ 또는 캐시/런타임) */
export function getAuditRetentionDays(): number {
  if (typeof window !== 'undefined') {
    const pub = process.env.NEXT_PUBLIC_AUDIT_LOG_RETENTION_DAYS
    if (pub) return parseDays(pub, retentionDays)
  }
  return retentionDays
}

export function getStorageAlertThreshold(): number {
  if (typeof window !== 'undefined') {
    const pub = process.env.NEXT_PUBLIC_STORAGE_ALERT_THRESHOLD
    if (pub) return parseThreshold(pub, alertThreshold)
  }
  return alertThreshold
}

export function setAuditUser(user: string | null | undefined): void {
  cachedUser = user?.trim() || 'guest'
}

export function getAuditUser(): string {
  return cachedUser
}

/** /api/runtime 에서 서버 env 반영 (실패 시 기본값 유지) */
export async function loadAuditConfigFromRuntime(): Promise<{
  retentionDays: number
  alertThreshold: number
}> {
  if (typeof window === 'undefined') {
    return { retentionDays: DEFAULT_RETENTION_DAYS, alertThreshold: DEFAULT_ALERT_THRESHOLD }
  }
  try {
    const res = await fetch('/api/runtime', { cache: 'no-store' })
    if (res.ok) {
      const json = (await res.json()) as {
        auditLogRetentionDays?: number
        storageAlertThreshold?: number
      }
      if (typeof json.auditLogRetentionDays === 'number') {
        retentionDays = Math.max(1, Math.min(365, Math.floor(json.auditLogRetentionDays)))
      }
      if (typeof json.storageAlertThreshold === 'number') {
        alertThreshold = Math.max(1, Math.min(50, Math.floor(json.storageAlertThreshold)))
      }
      try {
        localStorage.setItem(
          CONFIG_CACHE_KEY,
          JSON.stringify({ retentionDays, alertThreshold, at: Date.now() }),
        )
      } catch {
        /* ignore */
      }
    }
  } catch {
    try {
      const raw = localStorage.getItem(CONFIG_CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { retentionDays?: number; alertThreshold?: number }
        if (typeof parsed.retentionDays === 'number') retentionDays = parsed.retentionDays
        if (typeof parsed.alertThreshold === 'number') alertThreshold = parsed.alertThreshold
      }
    } catch {
      /* ignore */
    }
  }
  // NEXT_PUBLIC 우선
  const pubRet = process.env.NEXT_PUBLIC_AUDIT_LOG_RETENTION_DAYS
  const pubThr = process.env.NEXT_PUBLIC_STORAGE_ALERT_THRESHOLD
  if (pubRet) retentionDays = parseDays(pubRet, retentionDays)
  if (pubThr) alertThreshold = parseThreshold(pubThr, alertThreshold)
  return { retentionDays, alertThreshold }
}

function prune(entries: AuditLogEntry[], days = getAuditRetentionDays()): AuditLogEntry[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return entries
    .filter((e) => {
      const t = Date.parse(e.ts)
      return Number.isFinite(t) && t >= cutoff
    })
    .slice(-MAX_ENTRIES)
}

function readAll(): AuditLogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AuditLogEntry[]
    if (!Array.isArray(parsed)) return []
    return prune(parsed)
  } catch {
    return []
  }
}

function writeAll(entries: AuditLogEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(prune(entries)))
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch {
    /* quota 등 — 조용히 무시 */
  }
}

export function listAuditLogs(): AuditLogEntry[] {
  return readAll()
}

export function clearAuditLogs(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(LOG_KEY)
    localStorage.removeItem(STREAK_KEY)
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch {
    /* ignore */
  }
}

export function getConsecutiveSaveFailures(): number {
  if (typeof window === 'undefined') return 0
  try {
    const n = Number(localStorage.getItem(STREAK_KEY) ?? '0')
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

function setConsecutiveSaveFailures(n: number): void {
  if (typeof window === 'undefined') return
  try {
    if (n <= 0) localStorage.removeItem(STREAK_KEY)
    else localStorage.setItem(STREAK_KEY, String(n))
  } catch {
    /* ignore */
  }
}

export function estimatePayloadSize(data: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(data ?? null)).length
  } catch {
    return 0
  }
}

export type RecordAuditInput = {
  mode: StorageMode
  type: StorageDataType | string
  action?: AuditAction
  change: string
  status: AuditStatus
  size?: number
  durationMs?: number
  error?: string
  attempt?: number
  user?: string
}

/** 감사 로그 1건 기록 */
export function recordAudit(input: RecordAuditInput): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: uid(),
    ts: new Date().toISOString(),
    user: input.user ?? cachedUser,
    mode: input.mode,
    type: input.type,
    action: input.action ?? 'save',
    change: input.change,
    status: input.status,
    size: input.size,
    durationMs: input.durationMs,
    error: input.error,
    attempt: input.attempt,
  }

  const next = [...readAll(), entry]
  writeAll(next)
  return entry
}

/** 원격 저장 실패 시 연속 카운트 (fallback 포함) */
export function noteRemoteSaveOutcome(ok: boolean): number {
  if (ok) {
    setConsecutiveSaveFailures(0)
    return 0
  }
  const n = getConsecutiveSaveFailures() + 1
  setConsecutiveSaveFailures(n)
  return n
}

export function subscribeAuditLog(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onStorage = (e: StorageEvent) => {
    if (e.key === LOG_KEY || e.key === STREAK_KEY) listener()
  }
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}

function emptyModeStats() {
  return { total: 0, success: 0, failure: 0, avgDurationMs: 0 }
}

/** 대시보드용 집계 */
export function computeStorageObservabilityStats(
  entries = listAuditLogs(),
): StorageObservabilityStats {
  const saveLike = entries.filter((e) => e.action === 'save' || e.action === 'retry')
  const byMode: StorageObservabilityStats['byMode'] = {
    local: emptyModeStats(),
    cloud: emptyModeStats(),
    beacon: emptyModeStats(),
  }

  let success = 0
  let failure = 0
  let fallback = 0
  let durationSum = 0
  let durationCount = 0
  const reasonMap = new Map<string, number>()
  const hourMap = new Map<string, { success: number; failure: number; total: number }>()

  for (const e of saveLike) {
    const bucket = byMode[e.mode] ?? byMode.local
    bucket.total += 1
    if (e.status === 'success') {
      success += 1
      bucket.success += 1
    } else if (e.status === 'failure') {
      failure += 1
      bucket.failure += 1
      const reason = e.error?.trim() || 'unknown'
      reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1)
    } else if (e.status === 'fallback') {
      fallback += 1
      // 폴백은 부분 실패로 집계
      bucket.failure += 1
      failure += 1
      const reason = e.error?.trim() || 'fallback'
      reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1)
    }

    if (typeof e.durationMs === 'number' && Number.isFinite(e.durationMs)) {
      durationSum += e.durationMs
      durationCount += 1
      bucket.avgDurationMs += e.durationMs
    }

    const hourKey = e.ts.slice(0, 13) // YYYY-MM-DDTHH
    const h = hourMap.get(hourKey) ?? { success: 0, failure: 0, total: 0 }
    h.total += 1
    if (e.status === 'success') h.success += 1
    else h.failure += 1
    hourMap.set(hourKey, h)
  }

  for (const mode of Object.keys(byMode) as StorageMode[]) {
    const b = byMode[mode]
    if (b.total > 0 && b.avgDurationMs > 0) {
      // avgDurationMs 누적합 → 평균
      const samples = saveLike.filter(
        (e) => e.mode === mode && typeof e.durationMs === 'number',
      ).length
      b.avgDurationMs = samples > 0 ? Math.round(b.avgDurationMs / samples) : 0
    } else {
      b.avgDurationMs = 0
    }
  }

  const total = saveLike.length
  const hourly = [...hourMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-24)
    .map(([hour, v]) => ({
      hour: hour.slice(11) + ':00',
      success: v.success,
      failure: v.failure,
      total: v.total,
    }))

  const failureReasons = [...reasonMap.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return {
    total,
    success,
    failure,
    fallback,
    successRate: total === 0 ? 100 : Math.round((success / total) * 1000) / 10,
    avgDurationMs: durationCount === 0 ? 0 : Math.round(durationSum / durationCount),
    byMode,
    failureReasons,
    hourly,
    consecutiveFailures: getConsecutiveSaveFailures(),
    retentionDays: getAuditRetentionDays(),
    alertThreshold: getStorageAlertThreshold(),
  }
}

export { LOG_KEY, EVENT, DEFAULT_RETENTION_DAYS, DEFAULT_ALERT_THRESHOLD }
