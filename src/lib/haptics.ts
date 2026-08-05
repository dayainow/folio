/**
 * P57 — 터치 햅틱 · 제스처 유틸
 */
'use client'

/** 짧은 햅틱 (지원 기기만) */
export function haptic(ms: number | number[] = 10): void {
  if (typeof navigator === 'undefined') return
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms)
    }
  } catch {
    /* ignore */
  }
}

export function hapticTap(): void {
  haptic(8)
}

export function hapticSuccess(): void {
  haptic([12, 40, 12])
}

/** 화면 가장자리(좌측)에서 시작된 스와이프인지 */
export function isEdgeSwipeStart(clientX: number, edgePx = 28): boolean {
  if (typeof window === 'undefined') return false
  return clientX <= edgePx
}
