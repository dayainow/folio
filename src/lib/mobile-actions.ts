/**
 * P44 — 모바일 액션 버스 (FAB → 패널)
 */
'use client'

export type MobileAction =
  | { type: 'save' }
  | { type: 'new-doc' }
  | { type: 'new-journal' }
  | { type: 'fullscreen-toggle' }

const EVENT = 'folio-mobile-action'

export function dispatchMobileAction(action: MobileAction): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT, { detail: action }))
}

export function subscribeMobileAction(listener: (action: MobileAction) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<MobileAction>).detail
    if (detail?.type) listener(detail)
  }
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}

const FS_KEY = 'folio_mobile_fullscreen'

export function getMobileFullscreen(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(FS_KEY) === '1'
  } catch {
    return false
  }
}

export function setMobileFullscreen(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (on) localStorage.setItem(FS_KEY, '1')
    else localStorage.removeItem(FS_KEY)
    document.documentElement.classList.toggle('folio-mobile-fs', on)
    window.dispatchEvent(new CustomEvent('folio-mobile-fullscreen', { detail: on }))
  } catch {
    /* ignore */
  }
}

export function subscribeMobileFullscreen(listener: (on: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onCustom = (e: Event) => listener(Boolean((e as CustomEvent<boolean>).detail))
  window.addEventListener('folio-mobile-fullscreen', onCustom)
  return () => window.removeEventListener('folio-mobile-fullscreen', onCustom)
}
