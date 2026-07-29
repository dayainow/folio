'use client'

/**
 * P20 — 클라이언트 상태 점검 · 저장 실패 알림 · 토스트 이벤트
 */
import {
  getStorageMode,
  isBeaconAvailable,
  STORAGE_MODE_LABELS,
  type StorageMode,
} from '@/lib/storage'
import { notifyChannels } from '@/lib/notify-client'

export type HealthLevel = 'ok' | 'cloud-disconnected' | 'beacon-unlinked' | 'degraded'

export type StorageModeHealth = {
  mode: StorageMode
  label: string
  localOk: boolean
  cloudRelevant: boolean
  cloudOk: boolean | null
  beaconRelevant: boolean
  beaconOk: boolean | null
  message: string
}

export type SupabaseHealth = {
  configured: boolean
  connected: boolean
  authenticated: boolean
  message: string
}

export type BeaconHealth = {
  available: boolean
  root: string | null
  dbOk: boolean | null
  message: string
}

export type OverallHealth = {
  level: HealthLevel
  badgeLabel: string
  summary: string
  storage: StorageModeHealth
  supabase: SupabaseHealth
  beacon: BeaconHealth
  checkedAt: string
}

const HEALTH_EVENT = 'folio-health-refresh'
const TOAST_EVENT = 'folio-app-toast'
const ALERT_COOLDOWN_MS = 60_000
const TOAST_COOLDOWN_MS = 12_000

let lastWebhookAlertAt = 0
let lastToastAt = 0
let toastRetryHandler: (() => void) | null = null

function isPlaceholderUrl(url: string | undefined): boolean {
  if (!url) return true
  const u = url.toLowerCase()
  return (
    u.includes('placeholder') ||
    u.includes('your-project') ||
    u.includes('example.supabase') ||
    u === 'your-project-url'
  )
}

function probeLocalStorage(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const key = '__folio_health_ping__'
    localStorage.setItem(key, '1')
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/** 현재 저장 모드와 로컬/클라우드/Beacon 가용성 */
export async function checkStorageMode(): Promise<StorageModeHealth> {
  const mode = getStorageMode()
  const localOk = probeLocalStorage()
  const supabase = await checkSupabaseConnection()
  const beaconAvailable = await isBeaconAvailable()

  const cloudRelevant = mode === 'cloud'
  const beaconRelevant = mode === 'beacon'
  const cloudOk = cloudRelevant ? supabase.connected && supabase.authenticated : null
  const beaconOk = beaconRelevant ? beaconAvailable : null

  let message = `저장 모드: ${STORAGE_MODE_LABELS[mode]}`
  if (!localOk) message = '로컬 저장소를 사용할 수 없습니다'
  else if (cloudRelevant && cloudOk === false) message = '클라우드 동기화 불가 — 로컬만 사용 중'
  else if (beaconRelevant && beaconOk === false) message = 'Beacon 미연동 — 로컬만 사용 중'

  return {
    mode,
    label: STORAGE_MODE_LABELS[mode],
    localOk,
    cloudRelevant,
    cloudOk,
    beaconRelevant,
    beaconOk,
    message,
  }
}

/** Supabase env · 세션 · 간단 연결 확인 */
export async function checkSupabaseConnection(): Promise<SupabaseHealth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (isPlaceholderUrl(url) || !anon || anon.includes('placeholder') || anon.includes('your-anon')) {
    return {
      configured: false,
      connected: false,
      authenticated: false,
      message: 'Supabase 환경변수가 설정되지 않았습니다',
    }
  }

  try {
    const { createBrowserSupabaseClient } = await import('@/lib/supabase')
    const supabase = createBrowserSupabaseClient()
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      return {
        configured: true,
        connected: false,
        authenticated: false,
        message: error.message || 'Supabase 세션 조회 실패',
      }
    }
    const authenticated = Boolean(data.session?.user)
    return {
      configured: true,
      connected: true,
      authenticated,
      message: authenticated ? '로그인됨 · 연결 정상' : '연결 정상 · 미로그인',
    }
  } catch (err) {
    return {
      configured: true,
      connected: false,
      authenticated: false,
      message: err instanceof Error ? err.message : 'Supabase 연결 실패',
    }
  }
}

/** `.beacon` 경로 · project.json · DB 요약 */
export async function checkBeaconStatus(): Promise<BeaconHealth> {
  try {
    const availRes = await fetch('/api/beacon/available', { cache: 'no-store' })
    const avail = (await availRes.json().catch(() => null)) as {
      available?: boolean
      root?: string
    } | null

    const available = Boolean(avail?.available)
    const root = avail?.root ?? null

    if (!available) {
      return {
        available: false,
        root,
        dbOk: null,
        message: 'Beacon 미초기화 (.beacon/project.json 없음)',
      }
    }

    let dbOk: boolean | null = null
    try {
      const sumRes = await fetch('/api/beacon/summary', { cache: 'no-store' })
      if (sumRes.ok) {
        const sum = (await sumRes.json()) as { available?: boolean; source?: string }
        dbOk = Boolean(sum.available) || sum.source === 'db' || sum.source === 'project'
      } else {
        dbOk = false
      }
    } catch {
      dbOk = false
    }

    return {
      available: true,
      root,
      dbOk,
      message:
        dbOk === false
          ? 'Beacon 프로젝트는 있으나 요약/DB 읽기 실패'
          : `Beacon 연동됨${root ? ` · ${root}` : ''}`,
    }
  } catch {
    return {
      available: false,
      root: null,
      dbOk: null,
      message: 'Beacon 상태 API 호출 실패',
    }
  }
}

/** 종합 상태 + 헤더 뱃지 레벨 */
export async function overallHealth(): Promise<OverallHealth> {
  const [supabase, beacon] = await Promise.all([checkSupabaseConnection(), checkBeaconStatus()])
  const mode = getStorageMode()
  const localOk = probeLocalStorage()
  const cloudRelevant = mode === 'cloud'
  const beaconRelevant = mode === 'beacon'
  const cloudOk = cloudRelevant ? supabase.connected && supabase.authenticated : null
  const beaconOk = beaconRelevant ? beacon.available : null

  const storage: StorageModeHealth = {
    mode,
    label: STORAGE_MODE_LABELS[mode],
    localOk,
    cloudRelevant,
    cloudOk,
    beaconRelevant,
    beaconOk,
    message: `저장 모드: ${STORAGE_MODE_LABELS[mode]}`,
  }
  if (!localOk) storage.message = '로컬 저장소를 사용할 수 없습니다'
  else if (cloudRelevant && cloudOk === false) storage.message = '클라우드 동기화 불가 — 로컬만 사용 중'
  else if (beaconRelevant && beaconOk === false) storage.message = 'Beacon 미연동 — 로컬만 사용 중'

  let level: HealthLevel = 'ok'
  let badgeLabel = '정상'
  let summary = '저장·연동 상태가 정상입니다'

  // 우선순위: 클라우드 끊김 → Beacon 미연동 → 정상
  if (
    (cloudRelevant && cloudOk === false) ||
    (supabase.configured && !supabase.connected)
  ) {
    level = 'cloud-disconnected'
    badgeLabel = '클라우드 연결 끊김'
    summary = supabase.message
  } else if (!beacon.available || (beaconRelevant && beaconOk === false)) {
    level = 'beacon-unlinked'
    badgeLabel = 'Beacon 미연동'
    summary = beacon.message
  } else if (!localOk || beacon.dbOk === false) {
    level = 'degraded'
    badgeLabel = 'Beacon 미연동'
    summary = !localOk ? storage.message : beacon.message
  }

  return {
    level,
    badgeLabel,
    summary,
    storage,
    supabase,
    beacon,
    checkedAt: new Date().toISOString(),
  }
}

/** 원격 저장 폴백 시 Slack/Discord (쿨다운) */
export async function alertRemoteSaveFailure(
  kind: 'journal' | 'docs' | 'board' | string,
  mode: StorageMode,
): Promise<void> {
  const now = Date.now()
  if (now - lastWebhookAlertAt < ALERT_COOLDOWN_MS) {
    requestHealthRefresh()
    return
  }
  lastWebhookAlertAt = now

  const label = kind === 'journal' ? '일지' : kind === 'docs' ? '문서' : kind === 'board' ? '일정' : kind
  await notifyChannels(
    `⚠️ Folio 원격 저장 실패 · ${label} (mode=${mode})\n로컬에는 저장되었습니다. 연결을 확인해 주세요.`,
  )
  requestHealthRefresh()
}

export type AppToastDetail = {
  message: string
  withRetry?: boolean
}

export function showAppToast(message: string, opts?: { withRetry?: boolean }) {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (now - lastToastAt < TOAST_COOLDOWN_MS) return
  lastToastAt = now
  window.dispatchEvent(
    new CustomEvent<AppToastDetail>(TOAST_EVENT, {
      detail: { message, withRetry: opts?.withRetry ?? false },
    }),
  )
}

export function subscribeAppToast(listener: (detail: AppToastDetail) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<AppToastDetail>).detail
    if (detail) listener(detail)
  }
  window.addEventListener(TOAST_EVENT, handler)
  return () => window.removeEventListener(TOAST_EVENT, handler)
}

export function setToastRetryHandler(fn: (() => void) | null) {
  toastRetryHandler = fn
}

export function runToastRetry() {
  toastRetryHandler?.()
}

export function requestHealthRefresh() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(HEALTH_EVENT))
}

export function subscribeHealthRefresh(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(HEALTH_EVENT, listener)
  return () => window.removeEventListener(HEALTH_EVENT, listener)
}

export { HEALTH_EVENT, TOAST_EVENT }
