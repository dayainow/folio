'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Activity, BookOpen, GripVertical, Kanban, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { loadJournalsWithFallback } from '@/lib/journal'
import { loadTasksWithFallback, DEFAULT_COLUMNS, type Task } from '@/lib/board'
import { fetchBeaconSummary, type ProjectSummary } from '@/lib/beacon'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'folio_widget_order'
export type WidgetId = 'journal' | 'tasks' | 'gate'
const DEFAULT_ORDER: WidgetId[] = ['journal', 'tasks', 'gate']

function loadOrder(): WidgetId[] {
  if (typeof window === 'undefined') return DEFAULT_ORDER
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_ORDER
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return DEFAULT_ORDER
    const valid = parsed.filter((id): id is WidgetId => DEFAULT_ORDER.includes(id as WidgetId))
    const missing = DEFAULT_ORDER.filter((id) => !valid.includes(id))
    return [...valid, ...missing]
  } catch {
    return DEFAULT_ORDER
  }
}

function saveOrder(order: WidgetId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch {
    /* ignore */
  }
}

type WidgetDashboardProps = {
  onOpenTab?: (tab: 'journal' | 'board' | 'process') => void
}

function SortableWidget({
  id,
  children,
}: {
  id: WidgetId
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('relative', isDragging && 'z-10 opacity-90')}
    >
      <button
        type="button"
        className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 touch-manipulation"
        aria-label="위젯 순서 변경"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  )
}

function JournalWidget({
  preview,
  loading,
  onOpen,
}: {
  preview: { date: string; content: string } | null
  loading: boolean
  onOpen?: () => void
}) {
  return (
    <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 pr-12 bg-card shadow-sm h-full">
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight mb-2">
        <BookOpen className="h-4 w-4" aria-hidden />
        오늘의 일지
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> 불러오는 중…
        </p>
      ) : preview ? (
        <>
          <p className="text-[11px] text-muted-foreground tabular-nums mb-1">{preview.date}</p>
          <p className="text-sm leading-relaxed line-clamp-3 text-foreground/90 whitespace-pre-wrap">
            {preview.content || '(빈 일지)'}
          </p>
          {onOpen && (
            <Button type="button" variant="ghost" size="sm" className="mt-2 h-11 min-h-[44px] px-3 text-xs" onClick={onOpen}>
              일지 열기
            </Button>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">최근 일지가 없습니다.</p>
      )}
    </Card>
  )
}

function TasksWidget({
  counts,
  loading,
  onOpen,
}: {
  counts: Record<Task['status'], number>
  loading: boolean
  onOpen?: () => void
}) {
  const inProgress = counts.in_progress
  return (
    <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 pr-12 bg-card shadow-sm h-full">
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight mb-2">
        <Kanban className="h-4 w-4" aria-hidden />
        진행 중 태스크
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> 불러오는 중…
        </p>
      ) : (
        <>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{inProgress}</p>
          <p className="text-[11px] text-muted-foreground mb-3">In Progress</p>
          <ul className="grid grid-cols-2 gap-1.5">
            {DEFAULT_COLUMNS.map((col) => (
              <li
                key={col.key}
                className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 px-2 py-1.5 text-[11px]"
              >
                <span className="text-muted-foreground truncate">{col.label}</span>
                <span className="tabular-nums font-medium">{counts[col.key]}</span>
              </li>
            ))}
          </ul>
          {onOpen && (
            <Button type="button" variant="ghost" size="sm" className="mt-2 h-11 min-h-[44px] px-3 text-xs" onClick={onOpen}>
              일정 열기
            </Button>
          )}
        </>
      )}
    </Card>
  )
}

function GateWidget({
  summary,
  loading,
  onOpen,
}: {
  summary: ProjectSummary | null
  loading: boolean
  onOpen?: () => void
}) {
  return (
    <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4 pr-12 bg-card shadow-sm h-full">
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight mb-2">
        <Activity className="h-4 w-4" aria-hidden />
        Gate 상태
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> 불러오는 중…
        </p>
      ) : summary ? (
        <>
          <p className="text-sm font-medium truncate">{summary.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {summary.currentGate
              ? `${summary.currentGate.toUpperCase()} · ${summary.currentGateLabel}`
              : '현재 Gate 미확인'}
          </p>
          <div className="mt-3 flex items-end justify-between gap-2">
            <div>
              <div className="text-[10px] text-muted-foreground">진행률</div>
              <div className="text-xl font-semibold tabular-nums">{summary.progressPercent}%</div>
            </div>
            <div className="text-right text-[11px] text-muted-foreground">
              {summary.readyStages}/{summary.totalStages} Gate
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-foreground/70"
              style={{ width: `${Math.min(100, Math.max(0, summary.progressPercent))}%` }}
            />
          </div>
          {onOpen && (
            <Button type="button" variant="ghost" size="sm" className="mt-2 h-11 min-h-[44px] px-3 text-xs" onClick={onOpen}>
              프로세스 열기
            </Button>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Beacon이 없거나 아직 초기화되지 않았습니다.</p>
      )}
    </Card>
  )
}

/** 대시보드 위젯 — 순서 DnD · localStorage 저장 */
export function WidgetDashboard({ onOpenTab }: WidgetDashboardProps) {
  const [order, setOrder] = useState<WidgetId[]>(DEFAULT_ORDER)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [journalPreview, setJournalPreview] = useState<{ date: string; content: string } | null>(
    null,
  )
  const [taskCounts, setTaskCounts] = useState<Record<Task['status'], number>>({
    backlog: 0,
    in_progress: 0,
    review: 0,
    done: 0,
  })
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
        setJournalPreview({ date: today, content: todayEntry.content })
      } else {
        const latest = Object.entries(journals)
          .filter(([, e]) => e.content?.trim())
          .sort((a, b) => b[0].localeCompare(a[0]))[0]
        setJournalPreview(
          latest ? { date: latest[0], content: latest[1].content } : null,
        )
      }

      const counts: Record<Task['status'], number> = {
        backlog: 0,
        in_progress: 0,
        review: 0,
        done: 0,
      }
      for (const t of tasks) counts[t.status] += 1
      setTaskCounts(counts)

      setGateSummary(beacon?.available ? beacon.summary : null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setOrder(loadOrder())
      setReady(true)
      void refresh()
    }, 0)
    return () => window.clearTimeout(handle)
  }, [refresh])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as WidgetId)
      const newIndex = prev.indexOf(over.id as WidgetId)
      if (oldIndex < 0 || newIndex < 0) return prev
      const next = arrayMove(prev, oldIndex, newIndex)
      saveOrder(next)
      return next
    })
  }

  const widgets = useMemo(
    () => ({
      journal: (
        <JournalWidget
          preview={journalPreview}
          loading={loading}
          onOpen={onOpenTab ? () => onOpenTab('journal') : undefined}
        />
      ),
      tasks: (
        <TasksWidget
          counts={taskCounts}
          loading={loading}
          onOpen={onOpenTab ? () => onOpenTab('board') : undefined}
        />
      ),
      gate: (
        <GateWidget
          summary={gateSummary}
          loading={loading}
          onOpen={onOpenTab ? () => onOpenTab('process') : undefined}
        />
      ),
    }),
    [journalPreview, taskCounts, gateSummary, loading, onOpenTab],
  )

  if (!ready) {
    return (
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-36 rounded-2xl border border-gray-100 dark:border-gray-800 bg-muted/30 animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <section aria-label="대시보드 위젯" className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          위젯
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 min-h-[44px] px-3 text-xs"
          onClick={() => void refresh()}
        >
          새로고침
        </Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {order.map((id) => (
              <SortableWidget key={id} id={id}>
                {widgets[id]}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  )
}
