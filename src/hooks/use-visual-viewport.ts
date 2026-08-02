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

function readViewport(): VisualViewportState {
  if (typeof window === 'undefined') {
    return { height: 800, keyboardInset: 0, offsetTop: 0 }
  }
  const vv = window.visualViewport
  const layoutH = window.innerHeight
  if (!vv) {
    return { height: layoutH, keyboardInset: 0, offsetTop: 0 }
  }
  const keyboardInset = Math.max(0, Math.round(layoutH - vv.height - vv.offsetTop))
  return {
    height: Math.round(vv.height),
    keyboardInset,
    offsetTop: Math.round(vv.offsetTop),
  }
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
  return useSyncExternalStore(subscribe, readViewport, () => ({
    height: 800,
    keyboardInset: 0,
    offsetTop: 0,
  }))
}

/** 모바일 writing-first 에디터 권장 높이 (px) */
export function editorHeightFromViewport(
  vv: VisualViewportState,
  chromePx = 220,
): number {
  const h = Math.max(180, vv.height - chromePx)
  return Math.min(h, vv.height - 80)
}
