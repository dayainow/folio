import { describe, expect, it } from 'vitest'
import { computePerfHealthScore, type PerfHealthScore } from '@/lib/perf-score'
import type { PerfStats } from '@/lib/perf-metrics'

function emptyStats(partial?: Partial<PerfStats>): PerfStats {
  return {
    total: 0,
    webVitals: {},
    api: { count: 0, errorRate: 0, avgMs: 0, p75Ms: 0, byPath: [] },
    render: { count: 0, slowCount: 0, avgMs: 0, byComponent: [] },
    series: [],
    range: '24h',
    ...partial,
  }
}

describe('perf-score (P66)', () => {
  it('returns unknown without data', () => {
    const h = computePerfHealthScore(emptyStats())
    expect(h.score).toBeNull()
    expect(h.label).toBe('unknown')
  })

  it('scores good web vitals highly', () => {
    const h = computePerfHealthScore(
      emptyStats({
        webVitals: {
          LCP: { avg: 1200, p75: 1400, count: 3 },
          INP: { avg: 80, p75: 90, count: 3 },
          CLS: { avg: 0.02, p75: 0.03, count: 3 },
          TTFB: { avg: 200, p75: 250, count: 3 },
        },
      }),
    )
    expect(h.score).toBeGreaterThanOrEqual(90)
    expect(h.label).toBe('excellent')
  })

  it('penalizes slow API and renders', () => {
    const h: PerfHealthScore = computePerfHealthScore(
      emptyStats({
        webVitals: {
          LCP: { avg: 5000, p75: 5200, count: 2 },
        },
        api: { count: 10, errorRate: 20, avgMs: 900, p75Ms: 1600, byPath: [] },
        render: { count: 20, slowCount: 15, avgMs: 40, byComponent: [] },
      }),
    )
    expect(h.score).not.toBeNull()
    expect(h.score!).toBeLessThan(60)
    expect(h.label === 'fair' || h.label === 'poor').toBe(true)
  })
})
