/**
 * P42 — 터치 스와이프 제스처 (탭 전환 · 날짜 이동)
 */
'use client'

import { useEffect, useRef, type RefObject } from 'react'

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

export type UseSwipeOptions = {
  /** px — 이 거리 이상이면 스와이프로 인정 */
  threshold?: number
  /** 세로 스크롤과 구분하기 위한 최대 수직 비율 */
  maxVerticalRatio?: number
  onSwipe?: (dir: SwipeDirection) => void
  enabled?: boolean
}

/**
 * 요소에 수평 스와이프 리스너를 붙인다.
 * 세로 스크롤 중에는 발동하지 않도록 dy/dx 비율을 본다.
 */
export function useSwipe(
  ref: RefObject<HTMLElement | null>,
  { threshold = 56, maxVerticalRatio = 0.65, onSwipe, enabled = true }: UseSwipeOptions,
) {
  const onSwipeRef = useRef(onSwipe)

  useEffect(() => {
    onSwipeRef.current = onSwipe
  }, [onSwipe])

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    let startX = 0
    let startY = 0
    let tracking = false

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]!
      startX = t.clientX
      startY = t.clientY
      tracking = true
    }

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches[0]
      if (!t) return
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      if (absX < threshold) return
      if (absY > absX * maxVerticalRatio) return
      onSwipeRef.current?.(dx < 0 ? 'left' : 'right')
    }

    const onCancel = () => {
      tracking = false
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onCancel, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onCancel)
    }
  }, [ref, threshold, maxVerticalRatio, enabled])
}
