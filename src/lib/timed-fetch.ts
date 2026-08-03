/**
 * P50 — fetch 래퍼: CSRF + API 응답시간 기록
 */
'use client'

import { csrfHeaders } from '@/lib/csrf'
import { recordApiTiming } from '@/lib/perf-metrics'
import { maybeAlertApiSlow } from '@/lib/perf-alerts'

function pathFromInput(input: RequestInfo | URL): string {
  try {
    if (typeof input === 'string') {
      const u = new URL(input, typeof location !== 'undefined' ? location.origin : 'http://local')
      return u.pathname
    }
    if (input instanceof URL) return input.pathname
    return new URL(input.url).pathname
  } catch {
    return String(input)
  }
}

/** CSRF 헤더 + 타이밍 기록 fetch */
export async function timedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers)
  const csrf = csrfHeaders()
  for (const [k, v] of Object.entries(csrf)) {
    if (!headers.has(k)) headers.set(k, String(v))
  }

  const path = pathFromInput(input)
  const t0 = performance.now()
  let res: Response
  try {
    res = await fetch(input, { ...init, headers })
  } catch (err) {
    const ms = performance.now() - t0
    recordApiTiming({
      path,
      durationMs: ms,
      ok: false,
      detail: err instanceof Error ? err.message : 'network_error',
    })
    void maybeAlertApiSlow({ path, durationMs: ms })
    throw err
  }

  const ms = performance.now() - t0
  recordApiTiming({
    path,
    durationMs: ms,
    ok: res.ok,
    detail: res.ok ? undefined : `status_${res.status}`,
  })
  if (res.ok) void maybeAlertApiSlow({ path, durationMs: ms })
  return res
}

/** csrfFetch 별칭 — 기존 호출부 호환 */
export { timedFetch as csrfFetch }
