'use client'

/**
 * P23 — Beacon Timeline 자동 기록 동의 (기본 off)
 */

const KEY = 'folio_beacon_timeline_consent'
const EVENT = 'folio-beacon-timeline-consent'

export function getBeaconTimelineConsent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setBeaconTimelineConsent(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, enabled ? '1' : '0')
    window.dispatchEvent(new CustomEvent(EVENT, { detail: enabled }))
  } catch {
    /* ignore */
  }
}

export function subscribeBeaconTimelineConsent(listener: (enabled: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onCustom = (e: Event) => {
    listener(Boolean((e as CustomEvent<boolean>).detail))
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener(e.newValue === '1')
  }
  window.addEventListener(EVENT, onCustom)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, onCustom)
    window.removeEventListener('storage', onStorage)
  }
}

/** 동의 시에만 Timeline append (실패해도 UX 차단 안 함) */
export async function recordFolioTimelineEvent(input: {
  title: string
  detail?: string
  type?: string
  category?: string
}): Promise<void> {
  if (!getBeaconTimelineConsent()) return
  try {
    await fetch('/api/beacon/timeline', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        detail: input.detail ?? '',
        type: input.type ?? 'folio',
        category: input.category ?? 'folio',
      }),
    })
  } catch {
    /* ignore */
  }
}
