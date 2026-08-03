/**
 * P50 — 성능 메트릭 단위 테스트
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearPerfMetrics,
  computePerfStats,
  filterByRange,
  rateWebVital,
  recordApiTiming,
  recordPerfMetric,
  recordRenderTiming,
  recordWebVital,
  WEB_VITAL_THRESHOLDS,
} from '@/lib/perf-metrics'

describe('perf-metrics', () => {
  beforeEach(() => {
    clearPerfMetrics()
    localStorage.clear()
  })

  it('rates web vitals thresholds', () => {
    expect(rateWebVital('LCP', 2000)).toBe('good')
    expect(rateWebVital('LCP', 3000)).toBe('needs-improvement')
    expect(rateWebVital('LCP', 5000)).toBe('poor')
    expect(rateWebVital('CLS', 0.05)).toBe('good')
    expect(WEB_VITAL_THRESHOLDS.TTFB.good).toBe(800)
  })

  it('records vitals api render and computes stats', () => {
    recordWebVital({ name: 'LCP', value: 1800 })
    recordWebVital({ name: 'INP', value: 120 })
    recordWebVital({ name: 'CLS', value: 0.05 })
    recordWebVital({ name: 'TTFB', value: 400 })
    recordApiTiming({ path: '/api/notify', durationMs: 120, ok: true })
    recordApiTiming({ path: '/api/notify', durationMs: 80, ok: true })
    recordApiTiming({ path: '/api/health', durationMs: 40, ok: false, detail: 'status_500' })
    recordRenderTiming({ component: 'JournalPanel', durationMs: 22 })

    const stats = computePerfStats('24h')
    expect(stats.webVitals.LCP?.count).toBe(1)
    expect(stats.api.count).toBe(3)
    expect(stats.api.errorRate).toBeGreaterThan(0)
    expect(stats.api.byPath[0]?.path).toBeTruthy()
    expect(stats.render.slowCount).toBe(1)
    expect(stats.total).toBeGreaterThanOrEqual(7)
  })

  it('filters by range', () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    recordPerfMetric({
      kind: 'api',
      name: '/api/old',
      value: 10,
      unit: 'ms',
      ts: old,
      ok: true,
    })
    recordApiTiming({ path: '/api/new', durationMs: 5, ok: true })
    const day = filterByRange(
      [
        {
          id: '1',
          ts: old,
          kind: 'api',
          name: 'x',
          value: 1,
          unit: 'ms',
        },
        {
          id: '2',
          ts: new Date().toISOString(),
          kind: 'api',
          name: 'y',
          value: 1,
          unit: 'ms',
        },
      ],
      '24h',
    )
    expect(day).toHaveLength(1)
    expect(computePerfStats('24h').api.byPath.some((p) => p.path === '/api/new')).toBe(true)
  })
})
