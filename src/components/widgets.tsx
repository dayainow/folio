'use client'

/**
 * Writing-first 우측 사이드바 위젯 — 핵심 / 추가 분리 (P58+)
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { BookOpen, Kanban, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { loadJournalsWithFallback } from '@/lib/journal'
import { loadTasksWithFallback, type Task } from '@/lib/board'
import { AiSummaryWidget } from '@/components/ai-summary-widget'
import { ActivityFeed } from '@/components/activity-feed'
import { PluginWidgetHost } from '@/components/plugin-widget-host'
import { BookmarksSidebar, type BookmarkNavigate } from '@/components/bookmarks-sidebar'
import { cn } from '@/lib/utils'

export type WidgetSidebarProps = {
  onOpenTab?: (tab: 'journal' | 'docs' | 'board' | 'process') => void
  onBookmarkNavigate?: (payload: BookmarkNavigate) => void
  journalPreview?: { date: string; content: string } | null
  footer?: ReactNode
  className?: string
  /** 추가 위젯·footer 기본 펼침 (기본 false = 접힘) */
  defaultExtrasOpen?: boolean
}

const touchBtn =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-xs font-medium'

function useSummaryData(livePreview?: { date: string; content: string } | null) {
  const [loading, setLoading] = useState(true)
  const [storedPreview, setStoredPreview] = useState<{ date: string; content: string } | null>(
    null,
  )
  const [inProgress, setInProgress] = useState(0)
  const [taskTotal, setTaskTotal] = useState(0)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [journals, tasks] = await Promise.all([
        loadJournalsWithFallback().catch(() => ({}) as Record<string, { content: string }>),
        loadTasksWithFallback().catch(() => [] as Task[]),
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
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(handle)
  }, [refresh])

  return {
    loading,
    preview: livePreview ?? storedPreview,
    inProgress,
    taskTotal,
    refresh,
  }
}

/** 핵심 위젯: 오늘의 일지 · 진행 중 태스크 */
export function CoreSummaryWidgets({
  onOpenTab,
  journalPreview,
  className,
}: {
  onOpenTab?: WidgetSidebarProps['onOpenTab']
  journalPreview?: WidgetSidebarProps['journalPreview']
  className?: string
}) {
  const { loading, preview, inProgress, taskTotal, refresh } =
    useSummaryData(journalPreview)

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          오늘
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11"
          onClick={() => void refresh()}
          aria-label="위젯 새로고침"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      <section className="rounded-xl border border-gray-100 bg-card p-4 dark:border-gray-800">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
          오늘의 일지
        </div>
        {loading && !preview ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> 불러오는 중…
          </p>
        ) : preview ? (
          <>
            <p className="mb-1.5 text-[11px] tabular-nums text-muted-foreground">{preview.date}</p>
            <p className="line-clamp-5 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
              {preview.content.trim() || '(빈 일지)'}
            </p>
            {onOpenTab && (
              <button
                type="button"
                className={cn(
                  touchBtn,
                  'mt-3 w-full border border-border bg-muted/40 text-foreground hover:bg-muted',
                )}
                onClick={() => onOpenTab('journal')}
              >
                에디터로 이동
              </button>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">아직 일지가 없습니다.</p>
        )}
      </section>

      <Separator />

      <section className="rounded-xl border border-gray-100 bg-card p-4 dark:border-gray-800">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Kanban className="h-4 w-4 shrink-0" aria-hidden />
          진행 중 태스크
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{inProgress}</p>
            <div className="text-right text-[11px] text-muted-foreground">
              <div>In Progress</div>
              <div>전체 {taskTotal}</div>
            </div>
          </div>
        )}
        {onOpenTab && (
          <button
            type="button"
            className={cn(
              touchBtn,
              'mt-3 w-full border border-border bg-muted/40 text-foreground hover:bg-muted',
            )}
            onClick={() => onOpenTab('board')}
          >
            일정 보드 열기
          </button>
        )}
      </section>
    </div>
  )
}

/** 추가 위젯: 북마크 · AI · 플러그인 · 활동 */
export function ExtraSummaryWidgets({
  onBookmarkNavigate,
}: {
  onBookmarkNavigate?: WidgetSidebarProps['onBookmarkNavigate']
}) {
  return (
    <div className="flex flex-col gap-4">
      <Separator />
      <BookmarksSidebar onNavigate={onBookmarkNavigate} />
      <Separator />
      <AiSummaryWidget compact />
      <Separator />
      <PluginWidgetHost />
      <Separator />
      <section className="rounded-xl border border-gray-100 bg-card p-3 dark:border-gray-800">
        <ActivityFeed />
      </section>
    </div>
  )
}

/**
 * @deprecated SummarySidebar 사용 권장 — 호환용 전체 펼침 래퍼
 */
export function WidgetSidebar(props: WidgetSidebarProps) {
  return (
    <aside aria-label="요약 사이드바" className={cn('flex h-full w-full flex-col', props.className)}>
      <CoreSummaryWidgets
        onOpenTab={props.onOpenTab}
        journalPreview={props.journalPreview}
      />
      <div className="mt-4">
        <ExtraSummaryWidgets onBookmarkNavigate={props.onBookmarkNavigate} />
      </div>
      {props.footer && (
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          {props.footer}
        </div>
      )}
    </aside>
  )
}

/** @deprecated 이름 호환 — WidgetSidebar 사용. v2.0에서 제거 예정 */
export const WidgetDashboard = WidgetSidebar
