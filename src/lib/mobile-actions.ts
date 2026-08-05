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

/** P57 — CSS 풀스크린 + 가능하면 Fullscreen API */
export function setMobileFullscreen(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (on) localStorage.setItem(FS_KEY, '1')
    else localStorage.removeItem(FS_KEY)
    document.documentElement.classList.toggle('folio-mobile-fs', on)
    window.dispatchEvent(new CustomEvent('folio-mobile-fullscreen', { detail: on }))

    const root = document.documentElement
    if (on) {
      void root.requestFullscreen?.().catch(() => undefined)
    } else if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined)
    }
  } catch {
    /* ignore */
  }
}

export function subscribeMobileFullscreen(listener: (on: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onCustom = (e: Event) => listener(Boolean((e as CustomEvent<boolean>).detail))
  const onFsChange = () => {
    if (!document.fullscreenElement && getMobileFullscreen()) {
      // 사용자가 시스템으로 FS 종료 → 로컬 상태 동기화
      try {
        localStorage.removeItem(FS_KEY)
        document.documentElement.classList.remove('folio-mobile-fs')
      } catch {
        /* ignore */
      }
      listener(false)
    }
  }
  window.addEventListener('folio-mobile-fullscreen', onCustom)
  document.addEventListener('fullscreenchange', onFsChange)
  return () => {
    window.removeEventListener('folio-mobile-fullscreen', onCustom)
    document.removeEventListener('fullscreenchange', onFsChange)
  }
}
