/**
 * P48 — 협업 전송 모드: local | server | hybrid
 * - local: BroadcastChannel (+ 기존 Supabase Realtime은 hybrid/server에서만 강제하지 않음)
 * - server: Folio Collab WebSocket
 * - hybrid: WebSocket 우선 + BroadcastChannel 병행 (오프라인→온라인)
 */
'use client'

export type CollabMode = 'local' | 'server' | 'hybrid'

const MODE_KEY = 'folio_collab_mode'
const MODE_EVENT = 'folio-collab-mode'
const BANDWIDTH_KEY = 'folio_collab_bandwidth'
const WS_URL_KEY = 'folio_collab_ws_url'

const VALID: CollabMode[] = ['local', 'server', 'hybrid']

export const COLLAB_MODE_LABELS: Record<CollabMode, string> = {
  local: '로컬',
  server: '서버',
  hybrid: '하이브리드',
}

export type CollabBandwidthMode = 'full' | 'saver'

export function getCollabMode(): CollabMode {
  if (typeof window === 'undefined') return 'local'
  try {
    const raw = localStorage.getItem(MODE_KEY)
    if (raw && (VALID as string[]).includes(raw)) return raw as CollabMode
  } catch {
    /* ignore */
  }
  return 'local'
}

export function setCollabMode(mode: CollabMode): void {
  if (typeof window === 'undefined') return
  if (!(VALID as string[]).includes(mode)) return
  localStorage.setItem(MODE_KEY, mode)
  window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: mode }))
}

export function subscribeCollabMode(listener: (mode: CollabMode) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<CollabMode>).detail
    listener(detail ?? getCollabMode())
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === MODE_KEY) listener(getCollabMode())
  }
  window.addEventListener(MODE_EVENT, handler)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(MODE_EVENT, handler)
    window.removeEventListener('storage', onStorage)
  }
}

export function getCollabBandwidthMode(): CollabBandwidthMode {
  if (typeof window === 'undefined') return 'full'
  try {
    const raw = localStorage.getItem(BANDWIDTH_KEY)
    if (raw === 'saver' || raw === 'full') return raw
  } catch {
    /* ignore */
  }
  return 'full'
}

export function setCollabBandwidthMode(mode: CollabBandwidthMode): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(BANDWIDTH_KEY, mode)
  window.dispatchEvent(new CustomEvent('folio-collab-bandwidth', { detail: mode }))
}

/** 기본 WS URL — env 또는 localStorage 오버라이드 */
export function getCollabWsUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(WS_URL_KEY)?.trim()
      if (stored) return stored
    } catch {
      /* ignore */
    }
  }
  const fromEnv = process.env.NEXT_PUBLIC_COLLAB_WS_URL?.trim()
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.hostname}:1234`
  }
  return 'ws://127.0.0.1:1234'
}

export function setCollabWsUrl(url: string): void {
  if (typeof window === 'undefined') return
  const v = url.trim()
  if (!v) localStorage.removeItem(WS_URL_KEY)
  else localStorage.setItem(WS_URL_KEY, v)
}

export { MODE_KEY, MODE_EVENT, WS_URL_KEY }
