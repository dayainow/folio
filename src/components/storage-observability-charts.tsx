'use client'

/**
 * recharts 전용 청크 — 저장 관측 대시보드
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
import type { StorageObservabilityStats } from '@/lib/audit-log'
import type { StorageMode } from '@/lib/storage'
import { STORAGE_MODE_LABELS } from '@/lib/storage'

export default function StorageObservabilityCharts({
  hourly,
  byMode,
  reasons,
}: {
  hourly: StorageObservabilityStats['hourly']
  byMode: StorageObservabilityStats['byMode']
  reasons: StorageObservabilityStats['failureReasons']
}) {
  const modeData = (Object.keys(byMode) as StorageMode[]).map((mode) => ({
    name: STORAGE_MODE_LABELS[mode],
    성공: byMode[mode].success,
    실패: byMode[mode].failure,
    총: byMode[mode].total,
  }))

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="h-[200px] rounded-xl border border-gray-100 p-2 dark:border-gray-800">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={hourly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hour" tick={{ fontSize: 9 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 9 }} width={28} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line
              type="monotone"
              dataKey="success"
              name="성공"
              stroke="#059669"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="failure"
              name="실패"
              stroke="#d97706"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="h-[200px] rounded-xl border border-gray-100 p-2 dark:border-gray-800">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={modeData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 9 }} width={28} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="성공" stackId="a" fill="#059669" />
            <Bar dataKey="실패" stackId="a" fill="#d97706" />
          </BarChart>
        </ResponsiveContainer>
        {reasons.length === 0 ? null : (
          <p className="sr-only">실패 원인 {reasons.length}종</p>
        )}
      </div>
    </div>
  )
}
