'use client'

/**
 * P50 — 성능 관측 차트 (Recharts 청크)
 */
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import type { PerfStats } from '@/lib/perf-metrics'

export default function PerfObservabilityCharts({ stats }: { stats: PerfStats }) {
  const vitalBars = (['LCP', 'INP', 'CLS', 'TTFB'] as const)
    .map((name) => {
      const v = stats.webVitals[name]
      if (!v) return null
      return { name, p75: v.p75, avg: v.avg }
    })
    .filter(Boolean) as Array<{ name: string; p75: number; avg: number }>

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="h-[200px] rounded-xl border border-gray-100 p-2 dark:border-gray-800">
        <p className="mb-1 px-1 text-[10px] font-medium text-muted-foreground">추이 (LCP · API)</p>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={stats.series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="bucket" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} width={32} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="lcp" name="LCP" stroke="#0d9488" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="apiMs" name="API ms" stroke="#2563eb" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="errors" name="API 에러" stroke="#d97706" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="h-[200px] rounded-xl border border-gray-100 p-2 dark:border-gray-800">
        <p className="mb-1 px-1 text-[10px] font-medium text-muted-foreground">Web Vitals p75</p>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={vitalBars} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} width={32} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="p75" name="p75" fill="#0d9488" />
            <Bar dataKey="avg" name="avg" fill="#94a3b8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
