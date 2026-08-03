'use client'

/**
 * P50 — Web Vitals 수집기 (LCP · INP/FID · CLS · TTFB · FCP)
 */
import { useEffect } from 'react'
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals'
import { recordWebVital, type WebVitalName } from '@/lib/perf-metrics'
import { maybeAlertWebVital } from '@/lib/perf-alerts'

function handle(metric: Metric): void {
  const name = metric.name as WebVitalName
  if (!['LCP', 'INP', 'CLS', 'TTFB', 'FCP', 'FID'].includes(name)) return

  const value =
    name === 'CLS' ? Math.round(metric.value * 1000) / 1000 : Math.round(metric.value)

  recordWebVital({
    name,
    value,
    detail: metric.id,
  })

  void maybeAlertWebVital({ name, value, path: typeof location !== 'undefined' ? location.pathname : undefined })
}

export function WebVitalsReporter(): null {
  useEffect(() => {
    onLCP(handle)
    onINP(handle)
    onCLS(handle)
    onTTFB(handle)
    onFCP(handle)
  }, [])

  return null
}
