'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import {
  getBoardAnalytics,
  getJournalAnalytics,
  type AnalyticsRange,
  type BoardAnalytics,
  type JournalAnalytics,
} from '@/lib/analytics';
import { DEFAULT_COLUMNS } from '@/lib/board';

const RANGES: Array<{ key: AnalyticsRange; label: string }> = [
  { key: '1w', label: '1주' },
  { key: '1m', label: '1개월' },
  { key: '3m', label: '3개월' },
  { key: 'all', label: '전체' },
];

const PIE_COLORS = ['#111827', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#374151', '#1f2937', '#78716c'];

const STATUS_COLORS: Record<string, string> = {
  backlog: '#9ca3af',
  in_progress: '#3b82f6',
  review: '#eab308',
  done: '#22c55e',
};

function RangePicker({
  value,
  onChange,
}: {
  value: AnalyticsRange;
  onChange: (r: AnalyticsRange) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {RANGES.map(r => (
        <Button
          key={r.key}
          type="button"
          size="sm"
          variant={value === r.key ? 'default' : 'outline'}
          className={`h-7 text-[11px] ${value === r.key ? 'bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900' : ''}`}
          onClick={() => onChange(r.key)}
        >
          {r.label}
        </Button>
      ))}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 bg-card shadow-sm">
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-gray-400">{hint}</div>}
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-xs text-gray-400">
      {message}
    </div>
  );
}

export function JournalAnalyticsPanel() {
  const [range, setRange] = useState<AnalyticsRange>('1m');
  const [data, setData] = useState<JournalAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const changeRange = (next: AnalyticsRange) => {
    setRange(next);
    setLoading(true);
  };

  useEffect(() => {
    let cancelled = false;
    void getJournalAnalytics(range)
      .then(next => {
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : '통계 로드 실패');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const lineData = useMemo(() => {
    if (!data) return [];
    // 1주/1개월은 일별, 3개월/전체는 주간
    if (range === '1w' || range === '1m') {
      return data.daily.map(d => ({
        label: d.date.slice(5),
        count: d.count,
      }));
    }
    if (data.weekly.length > 0) {
      return data.weekly.map(w => ({
        label: w.week.slice(5),
        count: w.count,
      }));
    }
    return data.monthly.map(m => ({ label: m.month, count: m.count }));
  }, [data, range]);

  const pieData = useMemo(() => {
    if (!data) return [];
    return data.tags.slice(0, 8).map(t => ({ name: `#${t.tag}`, value: t.count }));
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">일지 통계</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">작성 추이 · 태그 빈도</p>
        </div>
        <RangePicker value={range} onChange={changeRange} />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {loading && <p className="text-xs text-gray-400">불러오는 중…</p>}

      {data && !loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="작성 일수" value={String(data.totalEntries)} />
            <StatCard label="총 단어" value={data.totalWords.toLocaleString()} />
            <StatCard label="태그 종류" value={String(data.tags.length)} />
            <StatCard
              label="기간"
              value={data.from ? `${data.from.slice(5)}~${data.to.slice(5)}` : '전체'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 bg-card shadow-sm">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">
                {range === '1w' || range === '1m' ? '일별 작성 추이' : '주간/월간 작성 추이'}
              </h3>
              {lineData.every(d => d.count === 0) ? (
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
        </>
      )}
    </div>
  );
}

function BoardHeatmap({ data }: { data: BoardAnalytics }) {
  const max = Math.max(1, ...data.heatmap.map(c => c.count));
  const statuses = DEFAULT_COLUMNS.map(c => c.key);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[320px]">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `48px repeat(${statuses.length}, minmax(56px, 1fr))` }}
        >
          <div />
          {DEFAULT_COLUMNS.map(col => (
            <div key={col.key} className="text-[10px] text-center text-gray-400 truncate px-0.5">
              {col.label}
            </div>
          ))}
          {WEEKDAY_ROWS.map(wd => (
            <div key={wd} className="contents">
              <div className="text-[11px] text-gray-500 flex items-center">{['월', '화', '수', '목', '금', '토', '일'][wd]}</div>
              {statuses.map(status => {
                const cell = data.heatmap.find(h => h.weekday === wd && h.status === status);
                const count = cell?.count ?? 0;
                const intensity = count / max;
                return (
                  <div
                    key={`${wd}-${status}`}
                    title={`${['월', '화', '수', '목', '금', '토', '일'][wd]} · ${status}: ${count}`}
                    className="h-8 rounded-md flex items-center justify-center text-[10px] tabular-nums border border-gray-100 dark:border-gray-800"
                    style={{
                      backgroundColor:
                        count === 0
                          ? 'transparent'
                          : `color-mix(in srgb, ${STATUS_COLORS[status]} ${Math.round(25 + intensity * 75)}%, transparent)`,
                      color: intensity > 0.55 ? '#fff' : undefined,
                    }}
                  >
                    {count || ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const WEEKDAY_ROWS = [0, 1, 2, 3, 4, 5, 6];

export function BoardAnalyticsPanel() {
  const [range, setRange] = useState<AnalyticsRange>('1m');
  const [data, setData] = useState<BoardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const changeRange = (next: AnalyticsRange) => {
    setRange(next);
    setLoading(true);
  };

  useEffect(() => {
    let cancelled = false;
    void getBoardAnalytics(range)
      .then(next => {
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : '분석 로드 실패');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const barData = useMemo(() => {
    if (!data) return [];
    return data.columns.map(c => ({
      name: c.label,
      count: c.count,
      fill: STATUS_COLORS[c.status],
    }));
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">보드 분석</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">컬럼 분포 · 상태 변경 히트맵 · 완료 시간</p>
        </div>
        <RangePicker value={range} onChange={changeRange} />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {loading && <p className="text-xs text-gray-400">불러오는 중…</p>}

      {data && !loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="태스크" value={String(data.totalTasks)} />
            <StatCard label="완료" value={String(data.completedCount)} />
            <StatCard
              label="평균 완료"
              value={
                data.avgCompletionHours == null
                  ? '—'
                  : data.avgCompletionHours < 24
                    ? `${data.avgCompletionHours.toFixed(1)}h`
                    : `${(data.avgCompletionHours / 24).toFixed(1)}d`
              }
              hint="created → done"
            />
            <StatCard
              label="기간"
              value={data.from ? `${data.from.slice(5)}~${data.to.slice(5)}` : '전체'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 bg-card shadow-sm">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">컬럼별 태스크 수</h3>
              {barData.every(d => d.count === 0) ? (
                <EmptyChart message="이 기간에 태스크가 없습니다" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={barData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="count" name="태스크" radius={[6, 6, 0, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 bg-card shadow-sm">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">
                상태 변경 히트맵
                <span className="ml-2 font-normal text-gray-400">(요일 × 상태)</span>
              </h3>
              {data.heatmap.every(c => c.count === 0) ? (
                <EmptyChart message="상태 변경 이력이 없습니다" />
              ) : (
                <BoardHeatmap data={data} />
              )}
              <p className="mt-3 text-[10px] text-gray-400">
                보드에서 상태를 바꾸면 이력이 쌓입니다. 이력이 없으면 최근 업데이트 기준으로 추정합니다.
              </p>
            </Card>
          </div>

          {data.statusChanges.length > 0 && (
            <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 bg-card shadow-sm">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">상태 변경 추이</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={aggregateStatusChangesByDay(data)}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {DEFAULT_COLUMNS.map(col => (
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
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function aggregateStatusChangesByDay(data: BoardAnalytics) {
  const map = new Map<string, Record<string, number | string>>();
  for (const p of data.statusChanges) {
    const row = map.get(p.date) ?? { date: p.date.slice(5) };
    row[p.status] = ((row[p.status] as number) ?? 0) + p.count;
    map.set(p.date, row);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, row]) => row);
}
