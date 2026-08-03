/**
 * P50 — 렌더 성능 측정 (Profiler / 느린 렌더 경고)
 */
'use client'

import {
  Profiler,
  useEffect,
  useRef,
  type ProfilerOnRenderCallback,
  type ReactNode,
} from 'react'
import { recordRenderTiming } from '@/lib/perf-metrics'

const SLOW_MS = Number(
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_PERF_RENDER_SLOW_MS ?? 16 : 16,
)

/** React Profiler — actualDuration 기록 (느린 렌더만 기본 저장) */
export function PerfProfiler({
  id,
  children,
  recordAll = false,
}: {
  id: string
  children: ReactNode
  recordAll?: boolean
}) {
  const onRender: ProfilerOnRenderCallback = (
    _id,
    _phase,
    actualDuration,
  ) => {
    if (!recordAll && actualDuration < SLOW_MS) return
    recordRenderTiming({
      component: id,
      durationMs: actualDuration,
      detail: actualDuration >= SLOW_MS ? 'slow_render' : undefined,
    })
    if (actualDuration >= SLOW_MS * 2 && process.env.NODE_ENV === 'development') {
      console.warn(`[perf] slow render ${id}: ${actualDuration.toFixed(1)}ms`)
    }
  }

  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  )
}

/** 마운트~페인트 대략 측정 */
export function useRenderMark(component: string): void {
  const marked = useRef(false)
  useEffect(() => {
    if (marked.current) return
    marked.current = true
    const t0 = performance.now()
    requestAnimationFrame(() => {
      recordRenderTiming({
        component,
        durationMs: performance.now() - t0,
        detail: 'mount_paint',
      })
    })
  }, [component])
}
