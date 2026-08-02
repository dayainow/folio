/**
 * P44 — Visual Viewport (가상 키보드) 대응
 */
'use client'

import { useSyncExternalStore } from 'react'

export type VisualViewportState = {
  /** CSS px — layout viewport 대비 보이는 높이 */
  height: number
  /** 키보드 등으로 가려진 하단 여백 추정 */
  keyboardInset: number
  offsetTop: number
}

const SERVER_SNAPSHOT: VisualViewportState = {
  height: 800,
  keyboardInset: 0,
  offsetTop: 0,
}

let cached: VisualViewportState = SERVER_SNAPSHOT

function readViewport(): VisualViewportState {
  if (typeof window === 'undefined') return SERVER_SNAPSHOT

  const vv = window.visualViewport
  const layoutH = window.innerHeight
  const next: VisualViewportState = !vv
    ? { height: layoutH, keyboardInset: 0, offsetTop: 0 }
    : {
        height: Math.round(vv.height),
        keyboardInset: Math.max(0, Math.round(layoutH - vv.height - vv.offsetTop)),
        offsetTop: Math.round(vv.offsetTop),
      }

  // 값이 같으면 동일 참조 유지 — useSyncExternalStore 무한 루프 방지
  if (
    cached.height === next.height &&
    cached.keyboardInset === next.keyboardInset &&
    cached.offsetTop === next.offsetTop
  ) {
    return cached
  }
  cached = next
  return cached
}

function getServerSnapshot(): VisualViewportState {
  return SERVER_SNAPSHOT
}

function subscribe(onChange: () => void) {
  const vv = window.visualViewport
  const handler = () => onChange()
  vv?.addEventListener('resize', handler)
  vv?.addEventListener('scroll', handler)
  window.addEventListener('resize', handler)
  return () => {
    vv?.removeEventListener('resize', handler)
    vv?.removeEventListener('scroll', handler)
    window.removeEventListener('resize', handler)
  }
}

/** 가상 키보드가 올라올 때 에디터 높이 보정용 */
export function useVisualViewport(): VisualViewportState {
  return useSyncExternalStore(subscribe, readViewport, getServerSnapshot)
}

/** 모바일 writing-first 에디터 권장 높이 (px) */
export function editorHeightFromViewport(
  vv: VisualViewportState,
  chromePx = 220,
): number {
  const h = Math.max(180, vv.height - chromePx)
  return Math.min(h, vv.height - 80)
}
