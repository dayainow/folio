/**
 * P48 — 협업 성능: throttle · 간단 압축 · 대역폭 절약
 */

import { getCollabBandwidthMode } from '@/lib/collab-mode'

/** 연속 호출을 leading+trailing으로 제한 */
export function throttle<T extends (...args: never[]) => void>(fn: T, waitMs: number): T {
  let last = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: Parameters<T> | null = null

  const run = (args: Parameters<T>) => {
    last = Date.now()
    pending = null
    fn(...args)
  }

  return ((...args: Parameters<T>) => {
    const now = Date.now()
    const remain = waitMs - (now - last)
    pending = args
    if (remain <= 0) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      run(args)
      return
    }
    if (!timer) {
      timer = setTimeout(() => {
        timer = null
        if (pending) run(pending)
      }, remain)
    }
  }) as T
}

/** 숫자 배열 RLE 압축 (모바일 saver용) — 작은 페이로드는 그대로 */
export function compressNumberArray(arr: number[]): { data: number[]; compressed: boolean } {
  if (arr.length < 64) return { data: arr, compressed: false }
  const out: number[] = []
  let i = 0
  while (i < arr.length) {
    const v = arr[i]!
    let count = 1
    while (i + count < arr.length && arr[i + count] === v && count < 255) count += 1
    if (count >= 3) {
      out.push(-1, v, count)
      i += count
    } else {
      out.push(v)
      i += 1
    }
  }
  if (out.length >= arr.length * 0.95) return { data: arr, compressed: false }
  return { data: out, compressed: true }
}

export function decompressNumberArray(data: number[], compressed?: boolean): number[] {
  if (!compressed) return data
  const out: number[] = []
  for (let i = 0; i < data.length; i += 1) {
    if (data[i] === -1 && i + 2 < data.length) {
      const v = data[i + 1]!
      const count = data[i + 2]!
      for (let c = 0; c < count; c += 1) out.push(v)
      i += 2
    } else {
      out.push(data[i]!)
    }
  }
  return out
}

export function yjsThrottleMs(): number {
  return getCollabBandwidthMode() === 'saver' ? 120 : 32
}

export function awarenessThrottleMs(): number {
  return getCollabBandwidthMode() === 'saver' ? 200 : 50
}

export function shouldCompressUpdates(): boolean {
  return getCollabBandwidthMode() === 'saver'
}
