/**
 * localStorage JSON 캐시. 쓰기는 기본 300ms debounce, flushLocalJson 으로 즉시 영속화.
 */
import { debounce } from '@/lib/debounce'
import { logError } from '@/lib/errors'

const DEFAULT_DELAY = 300
const memory = new Map<string, string>()
const writers = new Map<string, ReturnType<typeof debounce<(raw: string) => void>>> ()

function getWriter(key: string, delayMs: number) {
  let writer = writers.get(key)
  if (!writer) {
    writer = debounce((raw: string) => {
      if (typeof window === 'undefined') return
      try {
        localStorage.setItem(key, raw)
      } catch (err) {
        logError('local-cache.setItem', err, { key })
      }
    }, delayMs)
    writers.set(key, writer)
  }
  return writer
}

/** 메모리에 즉시 반영 + localStorage는 debounce 기록 */
export function setLocalJson(key: string, value: unknown, delayMs = DEFAULT_DELAY): void {
  const raw = JSON.stringify(value)
  memory.set(key, raw)
  if (typeof window === 'undefined') return
  getWriter(key, delayMs)(raw)
}

export function getLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const mem = memory.get(key)
  if (mem != null) {
    try {
      return JSON.parse(mem) as T
    } catch {
      /* fall through */
    }
  }
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    memory.set(key, raw)
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** 대기 중인 쓰기를 즉시 flush */
export function flushLocalJson(key?: string): void {
  if (key) {
    writers.get(key)?.flush()
    return
  }
  for (const w of writers.values()) w.flush()
}
