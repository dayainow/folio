'use client'

/**
 * Writing-first 우측 사이드바 위젯 (280px)
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Activity, BookOpen, Kanban, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { loadJournalsWithFallback } from '@/lib/journal'
import { loadTasksWithFallback, type Task } from '@/lib/board'
import { fetchBeaconSummary, type ProjectSummary } from '@/lib/beacon'
import { AiSummaryWidget } from '@/components/ai-summary-widget'
import { ActivityFeed } from '@/components/activity-feed'
import { PluginWidgetHost } from '@/components/plugin-widget-host'
import { cn } from '@/lib/utils'

export type WidgetSidebarProps = {
  onOpenTab?: (tab: 'journal' | 'board' | 'process') => void
  /** 좌측 일지 에디터와 연동된 미리보기 (있으면 우선) */
  journalPreview?: { date: string; content: string } | null
  footer?: ReactNode
  className?: string
}

/** @deprecated 이름 호환 — WidgetSidebar 사용. v2.0에서 제거 예정 */
export const WidgetDashboard = WidgetSidebar

export function WidgetSidebar({
  onOpenTab,
  journalPreview: livePreview,
  footer,
  className,
}: WidgetSidebarProps) {
  const [loading, setLoading] = useState(true)
  const [storedPreview, setStoredPreview] = useState<{ date: string; content: string } | null>(
    null,
  )
  const [inProgress, setInProgress] = useState(0)
  const [taskTotal, setTaskTotal] = useState(0)
  const [gateSummary, setGateSummary] = useState<ProjectSummary | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [journals, tasks, beacon] = await Promise.all([
        loadJournalsWithFallback().catch(() => ({}) as Record<string, { content: string }>),
        loadTasksWithFallback().catch(() => [] as Task[]),
        fetchBeaconSummary().catch(() => null),
      ])

      const today = new Date().toISOString().slice(0, 10)
      const todayEntry = journals[today]
      if (todayEntry?.content?.trim()) {
        setStoredPreview({ date: today, content: todayEntry.content })
      } else {
        const latest = Object.entries(journals)
          .filter(([, e]) => e.content?.trim())
          .sort((a, b) => b[0].localeCompare(a[0]))[0]
        setStoredPreview(latest ? { date: latest[0], content: latest[1].content } : null)
      }

      setInProgress(tasks.filter((t) => t.status === 'in_progress').length)
      setTaskTotal(tasks.length)
      setGateSummary(beacon?.available ? beacon.summary : null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(handle)
  }, [refresh])

  const preview = livePreview ?? storedPreview
  const progress = gateSummary?.progressPercent ?? 0

  return (
    <aside
      aria-label="요약 사이드바"
      className={cn(
        'flex h-full w-full flex-col gap-3 overflow-y-auto',
        className,
      )}
    >
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          요약
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => void refresh()}
          aria-label="위젯 새로고침"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* 오늘의 일지 미리보기 */}
      <section className="rounded-xl border border-gray-100 dark:border-gray-800 bg-card p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
          <BookOpen className="h-3.5 w-3.5" aria-hidden />
          오늘의 일지
        </div>
        {loading && !preview ? (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> 불러오는 중…
          </p>
        ) : preview ? (
          <>
            <p className="mb-1 text-[10px] tabular-nums text-muted-foreground">{preview.date}</p>
            <p className="line-clamp-5 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
              {preview.content.trim() || '(빈 일지)'}
            </p>
            {onOpenTab && (
              <button
                type="button"
                className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => onOpenTab('journal')}
              >
                에디터로 이동
              </button>
            )}
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">아직 일지가 없습니다.</p>
        )}
      </section>

      {/* 진행 중 태스크 — 숫자 + 링크 */}
      <section className="rounded-xl border border-gray-100 dark:border-gray-800 bg-card p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
          <Kanban className="h-3.5 w-3.5" aria-hidden />
          진행 중 태스크
        </div>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-2xl font-semibold tabular-nums tracking-tight">{inProgress}</p>
            <div className="text-right text-[10px] text-muted-foreground">
              <div>In Progress</div>
              <div>전체 {taskTotal}</div>
            </div>
          </div>
        )}
        {onOpenTab && (
          <button
            type="button"
            className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => onOpenTab('board')}
          >
            일정 보드 열기 →
          </button>
        )}
      </section>

      {/* Gate — 좁은 프로그레스 */}
      <section className="rounded-xl border border-gray-100 dark:border-gray-800 bg-card p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
          <Activity className="h-3.5 w-3.5" aria-hidden />
          Gate 상태
        </div>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : gateSummary ? (
          <>
            <p className="truncate text-xs font-medium">{gateSummary.name}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {gateSummary.currentGate
                ? `${gateSummary.currentGate.toUpperCase()} · ${gateSummary.currentGateLabel}`
                : 'Gate 미확인'}
              {' · '}
              {progress}%
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-foreground/70 transition-[width]"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">Beacon 미연동</p>
        )}
        {onOpenTab && (
          <button
            type="button"
            className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => onOpenTab('process')}
          >
            프로세스 열기 →
          </button>
        )}
      </section>

      {/* AI 요약 위젯 */}
      <AiSummaryWidget compact />

      {/* P51 플러그인 위젯 */}
      <PluginWidgetHost />

      {/* P41 활동 스트림 */}
      <section className="rounded-xl border border-gray-100 dark:border-gray-800 bg-card p-3">
        <ActivityFeed />
      </section>

      {footer && (
        <div className="mt-auto space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          {footer}
        </div>
      )}
    </aside>
  )
}
