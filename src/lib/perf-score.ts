/**
 * P66 — 성능 대시보드용 종합 스코어 (0–100)
 */
import {
  WEB_VITAL_THRESHOLDS,
  type PerfStats,
  type WebVitalName,
} from '@/lib/perf-metrics'

function vitalScore(name: WebVitalName, p75: number | undefined): number | null {
  if (p75 === undefined) return null
  const t = WEB_VITAL_THRESHOLDS[name]
  if (p75 <= t.good) return 100
  if (p75 >= t.poor) return 20
  const span = t.poor - t.good
  if (span <= 0) return 60
  return Math.round(100 - ((p75 - t.good) / span) * 80)
}

export type PerfHealthScore = {
  /** 0–100, 데이터 없으면 null */
  score: number | null
  label: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'
  parts: {
    vitals: number | null
    api: number | null
    render: number | null
  }
}

export function computePerfHealthScore(stats: PerfStats): PerfHealthScore {
  const vitalNames: WebVitalName[] = ['LCP', 'INP', 'CLS', 'TTFB']
  const vitalParts = vitalNames
    .map((n) => vitalScore(n, stats.webVitals[n]?.p75))
    .filter((v): v is number => v !== null)
  const vitals =
    vitalParts.length === 0
      ? null
      : Math.round(vitalParts.reduce((a, b) => a + b, 0) / vitalParts.length)

  let api: number | null = null
  if (stats.api.count > 0) {
    const latency =
      stats.api.p75Ms <= 200 ? 100 : stats.api.p75Ms >= 1500 ? 25 : Math.round(100 - ((stats.api.p75Ms - 200) / 1300) * 75)
    const err = Math.max(0, 100 - stats.api.errorRate * 8)
    api = Math.round(latency * 0.7 + err * 0.3)
  }

  let render: number | null = null
  if (stats.render.count > 0) {
    const slowRatio = stats.render.slowCount / Math.max(1, stats.render.count)
    render = Math.round(Math.max(15, 100 - slowRatio * 120))
  }

  const weighted: Array<{ w: number; v: number }> = []
  if (vitals !== null) weighted.push({ w: 0.55, v: vitals })
  if (api !== null) weighted.push({ w: 0.3, v: api })
  if (render !== null) weighted.push({ w: 0.15, v: render })

  if (weighted.length === 0) {
    return { score: null, label: 'unknown', parts: { vitals, api, render } }
  }

  const wSum = weighted.reduce((s, x) => s + x.w, 0)
  const score = Math.round(weighted.reduce((s, x) => s + (x.v * x.w) / wSum, 0))
  const label =
    score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 55 ? 'fair' : 'poor'

  return { score, label, parts: { vitals, api, render } }
}
