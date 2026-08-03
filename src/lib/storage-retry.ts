/**
 * P47 — 저장 재시도 · 지수 백오프
 */
export type RetryOptions = {
  /** 최대 시도 횟수 (기본 3) */
  maxAttempts?: number
  /** 초기 대기 ms (기본 250) */
  baseDelayMs?: number
  /** 최대 대기 ms (기본 4000) */
  maxDelayMs?: number
  /** 시도마다 콜백 (attempt는 1부터) */
  onAttempt?: (info: { attempt: number; error?: unknown }) => void
  signal?: AbortSignal
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function computeBackoffMs(
  attempt: number,
  baseDelayMs = 250,
  maxDelayMs = 4000,
): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1))
  const jitter = Math.floor(Math.random() * Math.min(100, baseDelayMs))
  return Math.min(maxDelayMs, exp + jitter)
}

/**
 * 지수 백오프로 fn 재시도.
 * 마지막 실패는 throw.
 */
export async function withBackoffRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3)
  const baseDelayMs = options.baseDelayMs ?? 250
  const maxDelayMs = options.maxDelayMs ?? 4000
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    options.onAttempt?.({ attempt })
    try {
      return await fn(attempt)
    } catch (err) {
      lastError = err
      options.onAttempt?.({ attempt, error: err })
      if (attempt >= maxAttempts) break
      const delay = computeBackoffMs(attempt, baseDelayMs, maxDelayMs)
      await sleep(delay, options.signal)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'retry failed'))
}
