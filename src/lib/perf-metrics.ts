/**
 * P50 — 성능 메트릭 (Web Vitals · API · 렌더) localStorage 저장
 */
'use client'

export type PerfMetricKind = 'web-vital' | 'api' | 'render' | 'nav' | 'alert'

export type WebVitalName = 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP' | 'FID'

export type PerfRange = '24h' | '7d' | '30d'

export type PerfMetricEntry = {
  id: string
  ts: string
  kind: PerfMetricKind
  /** LCP / GET /api/x / ComponentName */
  name: string
  /** ms (CLS는 score×1000 저장하지 않고 value 그대로; CLS는 단위 없음) */
  value: number
  unit: 'ms' | 'score' | 'count'
  path?: string
  ok?: boolean
  detail?: string
  rating?: 'good' | 'needs-improvement' | 'poor'
}

export type PerfStats = {
  total: number
  webVitals: Partial<Record<WebVitalName, { avg: number; p75: number; count: number; last?: number }>>
  api: {
    count: number
    errorRate: number
    avgMs: number
    p75Ms: number
    byPath: Array<{ path: string; avgMs: number; count: number; errors: number }>
  }
  render: {
    count: number
    slowCount: number
    avgMs: number
    byComponent: Array<{ name: string; avgMs: number; count: number; maxMs: number }>
  }
  series: Array<{ bucket: string; lcp?: number; apiMs?: number; errors: number; renders: number }>
  range: PerfRange
}

const LOG_KEY = 'folio_perf_metrics'
const EVENT = 'folio-perf-metrics'
const MAX_ENTRIES = 1500

const RANGE_MS: Record<PerfRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

/** Web Vitals 임계 (google chrome UX / web.dev 가이드 근사) */
export const WEB_VITAL_THRESHOLDS: Record<
  WebVitalName,
  { good: number; poor: number; unit: 'ms' | 'score' }
> = {
  LCP: { good: 2500, poor: 4000, unit: 'ms' },
  INP: { good: 200, poor: 500, unit: 'ms' },
  FID: { good: 100, poor: 300, unit: 'ms' },
  CLS: { good: 0.1, poor: 0.25, unit: 'score' },
  TTFB: { good: 800, poor: 1800, unit: 'ms' },
  FCP: { good: 1800, poor: 3000, unit: 'ms' },
}

export function rateWebVital(name: WebVitalName, value: number): 'good' | 'needs-improvement' | 'poor' {
  const t = WEB_VITAL_THRESHOLDS[name]
  if (value <= t.good) return 'good'
  if (value <= t.poor) return 'needs-improvement'
  return 'poor'
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function readAll(): PerfMetricEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PerfMetricEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(entries: PerfMetricEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch {
    /* quota */
  }
}

export function recordPerfMetric(
  input: Omit<PerfMetricEntry, 'id' | 'ts'> & { ts?: string },
): PerfMetricEntry {
  const entry: PerfMetricEntry = {
    id: uid(),
    ts: input.ts ?? new Date().toISOString(),
    kind: input.kind,
    name: input.name,
    value: input.value,
    unit: input.unit,
    path: input.path,
    ok: input.ok,
    detail: input.detail,
    rating: input.rating,
  }
  const next = [...readAll(), entry]
  writeAll(next)
  return entry
}

export function listPerfMetrics(limit = 200): PerfMetricEntry[] {
  return readAll().slice(-limit).reverse()
}

export function clearPerfMetrics(): void {
  writeAll([])
}

export function subscribePerfMetrics(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const on = () => listener()
  window.addEventListener(EVENT, on)
  window.addEventListener('storage', (e) => {
    if (e.key === LOG_KEY) on()
  })
  return () => {
    window.removeEventListener(EVENT, on)
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)] ?? 0
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
}

export function filterByRange(entries: PerfMetricEntry[], range: PerfRange): PerfMetricEntry[] {
  const cutoff = Date.now() - RANGE_MS[range]
  return entries.filter((e) => {
    const t = Date.parse(e.ts)
    return Number.isFinite(t) && t >= cutoff
  })
}

export function computePerfStats(range: PerfRange = '24h'): PerfStats {
  const all = filterByRange(readAll(), range)
  const vitals = all.filter((e) => e.kind === 'web-vital')
  const apis = all.filter((e) => e.kind === 'api')
  const renders = all.filter((e) => e.kind === 'render')

  const webVitals: PerfStats['webVitals'] = {}
  for (const name of Object.keys(WEB_VITAL_THRESHOLDS) as WebVitalName[]) {
    const vals = vitals
      .filter((e) => e.name === name)
      .map((e) => e.value)
      .sort((a, b) => a - b)
    if (vals.length === 0) continue
    webVitals[name] = {
      avg: avg(vals),
      p75: percentile(vals, 75),
      count: vals.length,
      last: vals[vals.length - 1],
    }
  }

  const apiErrors = apis.filter((e) => e.ok === false).length
  const apiMs = apis.map((e) => e.value).sort((a, b) => a - b)
  const byPathMap = new Map<string, { total: number; sum: number; errors: number }>()
  for (const e of apis) {
    const path = e.path ?? e.name
    const cur = byPathMap.get(path) ?? { total: 0, sum: 0, errors: 0 }
    cur.total += 1
    cur.sum += e.value
    if (e.ok === false) cur.errors += 1
    byPathMap.set(path, cur)
  }
  const byPath = [...byPathMap.entries()]
    .map(([path, v]) => ({
      path,
      avgMs: Math.round(v.sum / v.total),
      count: v.total,
      errors: v.errors,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  const slowRenders = renders.filter((e) => e.value >= 16)
  const byComp = new Map<string, { sum: number; count: number; max: number }>()
  for (const e of renders) {
    const cur = byComp.get(e.name) ?? { sum: 0, count: 0, max: 0 }
    cur.sum += e.value
    cur.count += 1
    cur.max = Math.max(cur.max, e.value)
    byComp.set(e.name, cur)
  }
  const byComponent = [...byComp.entries()]
    .map(([name, v]) => ({
      name,
      avgMs: Math.round((v.sum / v.count) * 10) / 10,
      count: v.count,
      maxMs: Math.round(v.max * 10) / 10,
    }))
    .sort((a, b) => b.maxMs - a.maxMs)
    .slice(0, 12)

  // 시계열 버킷
  const bucketMs = range === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const seriesMap = new Map<
    string,
    { lcp: number[]; api: number[]; errors: number; renders: number }
  >()
  for (const e of all) {
    const t = Date.parse(e.ts)
    if (!Number.isFinite(t)) continue
    const bucketStart = Math.floor(t / bucketMs) * bucketMs
    const label =
      range === '24h'
        ? new Date(bucketStart).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        : new Date(bucketStart).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    const cur = seriesMap.get(label) ?? { lcp: [], api: [], errors: 0, renders: 0 }
    if (e.kind === 'web-vital' && e.name === 'LCP') cur.lcp.push(e.value)
    if (e.kind === 'api') {
      cur.api.push(e.value)
      if (e.ok === false) cur.errors += 1
    }
    if (e.kind === 'render') cur.renders += 1
    seriesMap.set(label, cur)
  }
  const series = [...seriesMap.entries()].map(([bucket, v]) => ({
    bucket,
    lcp: v.lcp.length ? avg(v.lcp) : undefined,
    apiMs: v.api.length ? avg(v.api) : undefined,
    errors: v.errors,
    renders: v.renders,
  }))

  return {
    total: all.length,
    webVitals,
    api: {
      count: apis.length,
      errorRate: apis.length === 0 ? 0 : Math.round((apiErrors / apis.length) * 1000) / 10,
      avgMs: avg(apiMs),
      p75Ms: percentile(apiMs, 75),
      byPath,
    },
    render: {
      count: renders.length,
      slowCount: slowRenders.length,
      avgMs: avg(renders.map((e) => e.value)),
      byComponent,
    },
    series,
    range,
  }
}

/** API 타이밍 기록 헬퍼 */
export function recordApiTiming(input: {
  path: string
  durationMs: number
  ok: boolean
  detail?: string
}): PerfMetricEntry {
  return recordPerfMetric({
    kind: 'api',
    name: input.path,
    path: input.path,
    value: Math.round(input.durationMs),
    unit: 'ms',
    ok: input.ok,
    detail: input.detail,
  })
}

export function recordRenderTiming(input: {
  component: string
  durationMs: number
  detail?: string
}): PerfMetricEntry {
  return recordPerfMetric({
    kind: 'render',
    name: input.component,
    value: Math.round(input.durationMs * 100) / 100,
    unit: 'ms',
    detail: input.detail,
    ok: input.durationMs < 16,
  })
}

export function recordWebVital(input: {
  name: WebVitalName
  value: number
  path?: string
  detail?: string
}): PerfMetricEntry {
  const rating = rateWebVital(input.name, input.value)
  return recordPerfMetric({
    kind: 'web-vital',
    name: input.name,
    value: input.value,
    unit: WEB_VITAL_THRESHOLDS[input.name].unit,
    path: input.path ?? (typeof location !== 'undefined' ? location.pathname : undefined),
    rating,
    detail: input.detail,
    ok: rating !== 'poor',
  })
}
