/**
 * P42/P44 — 터치 스와이프 (수평 탭/날짜 · 수직 사이드바)
 */
'use client'

import { useEffect, useRef, type RefObject } from 'react'

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

export type UseSwipeOptions = {
  threshold?: number
  /** 수평 스와이프 시 허용 수직 비율 */
  maxCrossRatio?: number
  onSwipe?: (dir: SwipeDirection) => void
  enabled?: boolean
  /** P44 — 감지 축 */
  axis?: 'horizontal' | 'vertical' | 'both'
}

/**
 * 요소에 스와이프 리스너를 붙인다.
 * 스크롤과 구분하기 위해 주축 대비 교차축 비율을 본다.
 */
export function useSwipe(
  ref: RefObject<HTMLElement | null>,
  {
    threshold = 56,
    maxCrossRatio = 0.65,
    onSwipe,
    enabled = true,
    axis = 'horizontal',
  }: UseSwipeOptions,
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

      const preferHorizontal = absX >= absY
      if (preferHorizontal) {
        if (axis === 'vertical') return
        if (absX < threshold) return
        if (absY > absX * maxCrossRatio) return
        onSwipeRef.current?.(dx < 0 ? 'left' : 'right')
        return
      }
      if (axis === 'horizontal') return
      if (absY < threshold) return
      if (absX > absY * maxCrossRatio) return
      onSwipeRef.current?.(dy < 0 ? 'up' : 'down')
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
  }, [ref, threshold, maxCrossRatio, enabled, axis])
}
