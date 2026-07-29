'use client';

import { useEffect, useMemo, useState, memo } from 'react';
import dynamic from 'next/dynamic';
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

const JournalCharts = dynamic(
  () => import('@/components/analytics-charts').then((m) => ({ default: m.JournalCharts })),
  {
    ssr: false,
    loading: () => <p className="text-xs text-gray-400 py-8 text-center">차트 로딩…</p>,
  },
);

const BoardColumnBarChart = dynamic(
  () => import('@/components/analytics-charts').then((m) => ({ default: m.BoardColumnBarChart })),
  {
    ssr: false,
    loading: () => <p className="text-xs text-gray-400 py-8 text-center">차트 로딩…</p>,
  },
);

const BoardStatusBarChart = dynamic(
  () => import('@/components/analytics-charts').then((m) => ({ default: m.BoardStatusBarChart })),
  {
    ssr: false,
    loading: () => <p className="text-xs text-gray-400 py-8 text-center">차트 로딩…</p>,
  },
);

const RANGES: Array<{ key: AnalyticsRange; label: string }> = [
  { key: '1w', label: '1주' },
  { key: '1m', label: '1개월' },
  { key: '3m', label: '3개월' },
  { key: 'all', label: '전체' },
];

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
      {RANGES.map((r) => (
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

const WEEKDAY_ROWS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function BoardHeatmap({ data }: { data: BoardAnalytics }) {
  const max = Math.max(1, ...data.heatmap.map((c) => c.count));
  const statuses = DEFAULT_COLUMNS.map((c) => c.key);
  const heatmapIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of data.heatmap) {
      map.set(`${h.weekday}:${h.status}`, h.count);
    }
    return map;
  }, [data.heatmap]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[320px]">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `48px repeat(${statuses.length}, minmax(56px, 1fr))` }}
        >
          <div />
          {DEFAULT_COLUMNS.map((col) => (
            <div key={col.key} className="text-[10px] text-center text-gray-400 truncate px-0.5">
              {col.label}
            </div>
          ))}
          {WEEKDAY_ROWS.map((wd) => (
            <div key={wd} className="contents">
              <div className="text-[11px] text-gray-500 flex items-center">{WEEKDAY_LABELS[wd]}</div>
              {statuses.map((status) => {
                const count = heatmapIndex.get(`${wd}:${status}`) ?? 0;
                const intensity = count / max;
                return (
                  <div
                    key={`${wd}-${status}`}
                    title={`${WEEKDAY_LABELS[wd]} · ${status}: ${count}`}
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

export const JournalAnalyticsPanel = memo(function JournalAnalyticsPanel() {
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
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      })
      .catch((err) => {
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
    if (range === '1w' || range === '1m') {
      return data.daily.map((d) => ({
        label: d.date.slice(5),
        count: d.count,
      }));
    }
    if (data.weekly.length > 0) {
      return data.weekly.map((w) => ({
        label: w.week.slice(5),
        count: w.count,
      }));
    }
    return data.monthly.map((m) => ({ label: m.month, count: m.count }));
  }, [data, range]);

  const pieData = useMemo(() => {
    if (!data) return [];
    return data.tags.slice(0, 8).map((t) => ({ name: `#${t.tag}`, value: t.count }));
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

          <JournalCharts
            lineData={lineData}
            pieData={pieData}
            rangeLabel={
              range === '1w' || range === '1m' ? '일별 작성 추이' : '주간/월간 작성 추이'
            }
          />
        </>
      )}
    </div>
  );
});

export const BoardAnalyticsPanel = memo(function BoardAnalyticsPanel() {
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
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '분석 로드 실패');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const columnBarData = useMemo(() => {
    if (!data) return [];
    return data.columns.map((c) => ({
      name: c.label,
      count: c.count,
      fill: STATUS_COLORS[c.status],
    }));
  }, [data]);

  const statusBarData = useMemo(() => (data ? aggregateStatusChangesByDay(data) : []), [data]);

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
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">
                컬럼별 태스크 수
              </h3>
              <BoardColumnBarChart data={columnBarData} />
            </Card>

            <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 bg-card shadow-sm">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">
                상태 변경 히트맵
              </h3>
              <BoardHeatmap data={data} />
            </Card>
          </div>

          <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 bg-card shadow-sm">
            <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">
              상태 변경 추이
            </h3>
            <BoardStatusBarChart data={statusBarData} />
          </Card>
        </>
      )}
    </div>
  );
});
