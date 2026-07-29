'use client';

/**
 * recharts 전용 청크 — analytics 패널에서 dynamic import
 */
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { DEFAULT_COLUMNS } from '@/lib/board';

const PIE_COLORS = ['#111827', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#374151', '#1f2937', '#78716c'];

const STATUS_COLORS: Record<string, string> = {
  backlog: '#9ca3af',
  in_progress: '#3b82f6',
  review: '#eab308',
  done: '#22c55e',
};

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-xs text-gray-400">
      {message}
    </div>
  );
}

export function JournalCharts({
  lineData,
  pieData,
  rangeLabel,
}: {
  lineData: Array<{ label: string; count: number }>;
  pieData: Array<{ name: string; value: number }>;
  rangeLabel: string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 bg-card shadow-sm">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">{rangeLabel}</h3>
        {lineData.every((d) => d.count === 0) ? (
          <EmptyChart message="이 기간에 작성된 일지가 없습니다" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={lineData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="count"
                name="작성"
                stroke="#111827"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 bg-card shadow-sm">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">태그 분포</h3>
        {pieData.length === 0 ? (
          <EmptyChart message="태그 데이터가 없습니다" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={36}
                paddingAngle={2}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}

export function BoardColumnBarChart({
  data,
}: {
  data: Array<{ name: string; count: number; fill: string }>;
}) {
  if (data.every((d) => d.count === 0)) {
    return (
      <div className="flex h-[220px] items-center justify-center text-xs text-gray-400">
        이 기간에 태스크가 없습니다
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Bar dataKey="count" name="태스크" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BoardStatusBarChart({
  data,
}: {
  data: Array<Record<string, number | string>>;
}) {
  if (data.length === 0) {
    return <EmptyChart message="상태 변경 이력이 없습니다" />;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {DEFAULT_COLUMNS.map((col) => (
          <Bar
            key={col.key}
            dataKey={col.key}
            name={col.label}
            stackId="a"
            fill={STATUS_COLORS[col.key]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export { STATUS_COLORS };
