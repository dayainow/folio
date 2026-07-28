'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Circle,
  FolderOpen,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  fetchBeaconSummary,
  loadBeaconFromDirectoryPicker,
  type ArtifactItem,
  type BeaconViewModel,
  type GateStatus,
  type StageState,
  type StageSummary,
  type TimelineItem,
} from '@/lib/beacon';

function gateLabel(status: GateStatus): string {
  switch (status) {
    case 'ready':
      return '통과';
    case 'needs_evidence':
      return '근거 필요';
    default:
      return '미확인';
  }
}

function stateLabel(state: StageState): string {
  switch (state) {
    case 'ready':
      return '완료';
    case 'current':
      return '현재';
    case 'upcoming':
      return '예정';
    default:
      return '—';
  }
}

function gateTone(status: GateStatus): string {
  switch (status) {
    case 'ready':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900';
    case 'needs_evidence':
      return 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-900';
    default:
      return 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800';
  }
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EmptyState({
  message,
  onPick,
  onRefresh,
  loading,
}: {
  message: string;
  onPick: () => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <Card className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-10 bg-card text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-900">
        <Activity className="h-5 w-5 text-gray-400" />
      </div>
      <h2 className="text-base font-semibold tracking-tight">{message}</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
        프로젝트 루트에서 Beacon CLI로 <code className="text-xs">.beacon/</code> 를 초기화한 뒤
        새로고침하거나, 로컬 <code className="text-xs">.beacon</code> 폴더를 직접 선택하세요.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          disabled={loading}
          onClick={onRefresh}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          서버에서 다시 읽기
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs gap-1.5 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900"
          disabled={loading}
          onClick={onPick}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          .beacon 폴더 선택
        </Button>
      </div>
    </Card>
  );
}

function ProjectCard({ view }: { view: BeaconViewModel }) {
  const summary = view.summary!;
  return (
    <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 p-5 bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Beacon 프로세스</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{summary.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            현재 Gate:{' '}
            <span className="text-foreground font-medium">
              {summary.currentGate
                ? `${summary.currentGate.toUpperCase()} · ${summary.currentGateLabel}`
                : '미확인 (스냅샷 없음)'}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            초기화 {formatWhen(summary.initializedAt)}
            {summary.scannedAt ? ` · 스캔 ${formatWhen(summary.scannedAt)}` : ''}
            {view.source === 'file-picker' ? ' · 로컬 폴더' : ' · 서버 FS'}
          </p>
        </div>
        <div className="min-w-[140px]">
          <div className="text-[11px] text-muted-foreground mb-1">
            진행률 {summary.readyStages}/{summary.totalStages} Gate
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gray-900 dark:bg-gray-100 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, summary.progressPercent))}%` }}
            />
          </div>
          <div className="mt-1 text-right text-sm font-semibold tabular-nums">
            {summary.progressPercent}%
          </div>
        </div>
      </div>
    </Card>
  );
}

function StageGrid({ stages }: { stages: StageSummary[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {stages.map((stage) => (
        <Card
          key={stage.id}
          className={`rounded-xl border p-3 shadow-sm ${
            stage.state === 'current'
              ? 'border-gray-900 dark:border-gray-100'
              : 'border-gray-100 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground">
              {stage.id.toUpperCase()}
            </span>
            <span className="text-[10px] text-muted-foreground">{stateLabel(stage.state)}</span>
          </div>
          <div className="mt-1 text-sm font-semibold">{stage.name}</div>
          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-snug">
            {stage.objective}
          </p>
          <div
            className={`mt-3 inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${gateTone(stage.gateStatus)}`}
          >
            {gateLabel(stage.gateStatus)}
            {stage.totalRequirements > 0
              ? ` · ${stage.satisfiedRequirements}/${stage.totalRequirements}`
              : ''}
          </div>
        </Card>
      ))}
    </div>
  );
}

function TimelineList({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Timeline 이력이 없습니다. Beacon 스캔 후 <code className="text-xs">beacon.db</code> 에 쌓입니다.
      </p>
    );
  }
  return (
    <ol className="relative space-y-0 border-l border-gray-200 dark:border-gray-800 ml-2">
      {items.map((item) => (
        <li key={item.id} className="relative pl-5 pb-5 last:pb-0">
          <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-gray-900 dark:bg-gray-100" />
          <div className="text-[11px] text-muted-foreground">{formatWhen(item.occurredAt)}</div>
          <div className="mt-0.5 text-sm font-medium leading-snug">{item.title}</div>
          {item.detail && (
            <p className="mt-0.5 text-[12px] text-muted-foreground leading-relaxed">{item.detail}</p>
          )}
          {(item.category || item.type) && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              {[item.type, item.category].filter(Boolean).join(' · ')}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function ArtifactChecklist({ items }: { items: ArtifactItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        산출물 목록이 없습니다. 최신 스냅샷이 있으면 여기 표시됩니다.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
      {items.map((item) => (
        <li
          key={item.path}
          className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-900/60"
        >
          {item.present ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Circle className="h-4 w-4 mt-0.5 shrink-0 text-gray-300" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{item.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {item.kind}
              {item.path ? ` · ${item.path}` : ''}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BeaconPanel() {
  const [view, setView] = useState<BeaconViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFromServer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBeaconSummary();
      setView(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패');
      setView({
        available: false,
        project: null,
        summary: null,
        timeline: [],
        artifacts: [],
        message: 'Beacon 프로젝트를 초기화하세요',
        source: 'none',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const pickFolder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadBeaconFromDirectoryPicker();
      setView(data);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // 사용자 취소
      } else {
        setError(e instanceof Error ? e.message : '폴더 읽기 실패');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadFromServer();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [loadFromServer]);

  if (loading && !view) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Beacon 상태 읽는 중…
      </div>
    );
  }

  if (!view?.available || !view.summary) {
    return (
      <div className="space-y-3">
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        <EmptyState
          message={view?.message ?? 'Beacon 프로젝트를 초기화하세요'}
          onPick={() => void pickFolder()}
          onRefresh={() => void loadFromServer()}
          loading={loading}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" />
          읽기 전용 · Folio는 `.beacon` 을 수정하지 않습니다
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            disabled={loading}
            onClick={() => void loadFromServer()}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            새로고침
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            disabled={loading}
            onClick={() => void pickFolder()}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            폴더 선택
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <ProjectCard view={view} />
      <StageGrid stages={view.summary.stages} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 p-5 bg-card shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight mb-4">Timeline</h3>
          <TimelineList items={view.timeline} />
        </Card>
        <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 p-5 bg-card shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight mb-1">산출물 체크리스트</h3>
          <p className="text-[11px] text-muted-foreground mb-4">
            최신 스냅샷 기준 · {view.artifacts.length}개
          </p>
          <ArtifactChecklist items={view.artifacts} />
        </Card>
      </div>
    </div>
  );
}
