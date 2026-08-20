'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ChevronDown,
  FileText,
  Inbox,
  PenLine,
  RefreshCw,
  Send,
  Sparkles,
  SunMedium,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/components/i18n-provider'
import { loadJournalsWithFallback, saveJournalWithFallback, type JournalEntry } from '@/lib/journal'
import { loadDocsWithFallback, type DocEntry } from '@/lib/docs'
import { loadTasksWithFallback, type Task } from '@/lib/board'
import {
  createJournalEntryKey,
  dailyJourneyPhase,
  journalExcerpt,
  journalTitle,
  isWorkspaceEmpty,
  localDateKey,
  selectMemoryMoments,
} from '@/lib/personal-assistant'
import { cn } from '@/lib/utils'
import { DailyReviewCard } from '@/components/daily-review-card'
import { loadDailyReview } from '@/lib/daily-review'
import { WeeklyReviewCard } from '@/components/weekly-review-card'
import { WeeklyFocusCard } from '@/components/weekly-focus-card'
import { DailyPlanCard } from '@/components/daily-plan-card'
import { MorningBriefingCard } from '@/components/morning-briefing-card'

type CaptureMode = 'memo' | 'idea' | 'decision'

const CAPTURE_MODES: Array<{
  value: CaptureMode
  label: string
  tag: string
  placeholder: string
}> = [
  { value: 'memo', label: '메모', tag: '메모', placeholder: '지금 떠오른 생각이나 있었던 일을 적어보세요.' },
  { value: 'idea', label: '아이디어', tag: '아이디어', placeholder: '놓치고 싶지 않은 아이디어를 적어보세요.' },
  { value: 'decision', label: '결정', tag: '결정', placeholder: '무엇을 왜 결정했는지 남겨보세요.' },
]

type DashboardData = {
  journals: Record<string, JournalEntry>
  docs: DocEntry[]
  tasks: Task[]
}

const EMPTY_DATA: DashboardData = { journals: {}, docs: [], tasks: [] }

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 11) return '좋은 아침이에요'
  if (hour < 18) return '오늘도 잘 기록하고 있어요'
  return '오늘 하루를 천천히 정리해봐요'
}

function formatToday(now: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(now)
}

export function PersonalAssistantHome({
  onOpenJournal,
  onOpenDocs,
  onOpenBoard,
}: {
  onOpenJournal: (entryKey: string, date: string) => void
  onOpenDocs: (docId?: string) => void
  onOpenBoard: (taskId?: string) => void
}) {
  const { locale } = useI18n()
  const [now] = useState(() => new Date())
  const [data, setData] = useState<DashboardData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [captureMode, setCaptureMode] = useState<CaptureMode>('memo')
  const [capture, setCapture] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const captureRef = useRef<HTMLTextAreaElement>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [journals, docs, tasks] = await Promise.all([
        loadJournalsWithFallback(),
        loadDocsWithFallback(),
        loadTasksWithFallback(),
      ])
      setData({ journals, docs, tasks })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0)
    const onFocus = () => void refresh()
    const onDataChange = () => void refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener('folio-journals-changed', onDataChange)
    window.addEventListener('folio-tasks-changed', onDataChange)
    return () => {
      window.clearTimeout(initialRefresh)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('folio-journals-changed', onDataChange)
      window.removeEventListener('folio-tasks-changed', onDataChange)
    }
  }, [refresh])

  const today = localDateKey(now)
  const previousReview = useMemo(() => {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return loadDailyReview(localDateKey(yesterday))
  }, [now])
  const todayEntries = useMemo(
    () =>
      Object.entries(data.journals)
        .filter(([, entry]) => entry.date === today && entry.content.trim())
        .sort((a, b) => (b[1].createdAt ?? b[1].updatedAt).localeCompare(a[1].createdAt ?? a[1].updatedAt)),
    [data.journals, today],
  )
  const activeTasks = useMemo(
    () =>
      data.tasks
        .filter((task) => task.status !== 'done')
        .sort((a, b) => {
          const statusScore = { in_progress: 3, review: 2, backlog: 1, done: 0 }
          const priorityScore = { high: 3, medium: 2, low: 1 }
          return statusScore[b.status] - statusScore[a.status] || priorityScore[b.priority] - priorityScore[a.priority]
        }),
    [data.tasks],
  )
  const recentDocs = useMemo(
    () => [...data.docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3),
    [data.docs],
  )
  const sourcedContext = useMemo(() => {
    const docs = data.docs
      .filter((doc) => doc.provenance || doc.tags?.some((tag) => tag.startsWith('source-system:')))
      .map((doc) => ({
        id: doc.id,
        kind: 'doc' as const,
        title: doc.title || '제목 없는 문서',
        system: doc.provenance?.system ?? doc.tags?.find((tag) => tag.startsWith('source-system:'))?.slice(14) ?? 'file',
        updatedAt: doc.updatedAt,
      }))
    const journals = Object.entries(data.journals)
      .filter(([, entry]) => entry.provenance || entry.tags?.some((tag) => tag.startsWith('source-system:')))
      .map(([id, entry]) => ({
        id,
        kind: 'journal' as const,
        title: journalTitle(entry.content),
        system: entry.provenance?.system ?? entry.tags?.find((tag) => tag.startsWith('source-system:'))?.slice(14) ?? 'file',
        updatedAt: entry.updatedAt,
      }))
    return [...docs, ...journals].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3)
  }, [data.docs, data.journals])
  const memories = useMemo(() => selectMemoryMoments(data.journals, now), [data.journals, now])
  const workspaceIsEmpty = !loading && isWorkspaceEmpty(data.journals, data.docs, data.tasks)
  const selectedMode = CAPTURE_MODES.find((mode) => mode.value === captureMode) ?? CAPTURE_MODES[0]!
  const journeyPhase = dailyJourneyPhase(now)

  const focusCapture = () => {
    captureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => captureRef.current?.focus(), 350)
  }

  const openIntake = () => {
    window.location.hash = 'docs/intake'
    onOpenDocs()
  }

  const primaryAction = workspaceIsEmpty
    ? { label: '첫 메모 남기기', icon: PenLine, action: focusCapture }
    : journeyPhase === 'plan'
      ? { label: '오늘 계획 보기', icon: CalendarDays, action: () => onOpenBoard() }
      : journeyPhase === 'capture'
        ? { label: '지금 기록하기', icon: PenLine, action: focusCapture }
        : { label: '오늘 정리하기', icon: ClipboardCheck, action: () => onOpenJournal(today, today) }
  const PrimaryActionIcon = primaryAction.icon

  const saveCapture = async () => {
    const content = capture.trim()
    if (!content || saving) return
    setSaving(true)
    setSavedMessage('')
    const entryKey = createJournalEntryKey(today)
    try {
      await saveJournalWithFallback(today, content, [selectedMode.tag], entryKey)
      setCapture('')
      setSavedMessage('새 기록으로 저장했어요.')
      window.dispatchEvent(new CustomEvent('folio-journals-changed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="folio-home mx-auto w-full max-w-6xl space-y-6 pb-8" aria-busy={loading}>
      <section className="folio-hero overflow-hidden rounded-[1.75rem] px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="folio-eyebrow inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]">
                <Sparkles className="size-3" />
                오늘
              </div>
              <p className="text-xs font-medium text-muted-foreground">{formatToday(now, locale)}</p>
            </div>
            <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-[-0.04em] sm:text-[2.15rem]">{greeting(now)}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              기록하고, 정리하고, 가장 중요한 일에 집중하세요.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" className="folio-primary-action h-10 gap-2 rounded-full px-5" onClick={primaryAction.action}>
              <PrimaryActionIcon className="size-3.5" />
              {primaryAction.label}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-2 rounded-full border-foreground/10 bg-background/60 px-4 shadow-none"
              onClick={openIntake}
            >
              <Inbox className="size-3.5" />
              수집함
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-foreground/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 text-[11px] font-medium text-muted-foreground" aria-label="오늘의 현황">
            <span><strong className="font-semibold text-foreground">{loading ? '–' : todayEntries.length}</strong> 기록</span>
            <span><strong className="font-semibold text-foreground">{loading ? '–' : activeTasks.length}</strong> 할 일</span>
            <span><strong className="font-semibold text-foreground">{loading ? '–' : recentDocs.length}</strong> 최근 문서</span>
          </div>
          {previousReview?.tomorrow ? (
            <button type="button" onClick={primaryAction.action} className="group flex min-w-0 items-center gap-2 text-left text-xs text-muted-foreground transition-colors hover:text-foreground">
              <span className="shrink-0 font-semibold text-teal-800 dark:text-teal-300">첫 행동</span>
              <span className="truncate">{previousReview.tomorrow}</span>
              <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground">작은 기록부터 가볍게 시작해보세요.</span>
          )}
        </div>
      </section>

      <MorningBriefingCard date={today} tasks={data.tasks} previousReview={previousReview} onOpenBoard={onOpenBoard} />

      {workspaceIsEmpty ? (
        <section aria-labelledby="getting-started-title" className="folio-surface flex flex-col gap-4 rounded-[1.5rem] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Your first step</p>
            <h2 id="getting-started-title" className="mt-1.5 text-lg font-semibold tracking-tight">오늘, 한 가지만 시작해볼까요?</h2>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">짧은 메모를 남기거나 기존 자료를 가져오면 Folio가 다음 행동을 정리해드려요.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button className="gap-2 rounded-full" onClick={focusCapture}>
              <PenLine className="size-3.5" />첫 메모 남기기
            </Button>
            <Button variant="outline" className="gap-2 rounded-full" onClick={openIntake}>
              <Inbox className="size-3.5" />자료 가져오기
            </Button>
          </div>
        </section>
      ) : null}

      <WeeklyFocusCard date={today} tasks={data.tasks} onOpenBoard={onOpenBoard} />

      <DailyPlanCard date={today} tasks={data.tasks} onOpenBoard={onOpenBoard} />

      {sourcedContext.length > 0 ? (
        <section aria-labelledby="context-title" className="flex flex-col gap-3 rounded-[1.4rem] border border-foreground/10 bg-card/55 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Inbox className="size-4 text-teal-700 dark:text-teal-300" />
              <h2 id="context-title" className="text-sm font-semibold">연결된 업무 맥락</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{sourcedContext.length}개 최근 항목</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {sourcedContext.map((item) => (
                <button key={`${item.kind}-${item.id}`} type="button" className="max-w-56 truncate text-left text-xs text-muted-foreground hover:text-foreground" onClick={() => item.kind === 'doc' ? onOpenDocs(item.id) : onOpenJournal(item.id, data.journals[item.id]?.date ?? today)}>
                  <span className="font-medium text-foreground/80">{item.system}</span> · {item.title}
                </button>
              ))}
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5 rounded-full" onClick={openIntake}>
            <Inbox className="size-3.5" />자료 더 가져오기
          </Button>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <Card className="folio-surface gap-0 border-0 py-0">
          <CardHeader className="gap-4 border-b border-foreground/[0.07] px-5 py-5 sm:flex sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <CardTitle className="text-lg">빠른 기록</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">떠오른 것을 잊기 전에 남겨보세요.</p>
            </div>
            <div className="flex w-fit flex-wrap gap-0.5 rounded-xl bg-muted/60 p-1" aria-label="기록 종류">
              {CAPTURE_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setCaptureMode(mode.value)}
                  aria-pressed={captureMode === mode.value}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs transition-colors',
                    captureMode === mode.value
                      ? 'bg-background font-medium text-foreground shadow-sm ring-1 ring-foreground/[0.06]'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="px-5 py-5 sm:px-6">
            <label htmlFor="quick-capture-content" className="sr-only">빠른 기록 내용</label>
            <Textarea
              id="quick-capture-content"
              ref={captureRef}
              aria-describedby="quick-capture-status"
              value={capture}
              onChange={(event) => {
                setCapture(event.target.value)
                setSavedMessage('')
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault()
                  void saveCapture()
                }
              }}
              rows={6}
              className="min-h-32 resize-y rounded-xl border-foreground/10 bg-background px-4 py-3 text-sm leading-6 shadow-none focus-visible:border-foreground/20 focus-visible:ring-2 focus-visible:ring-foreground/10 sm:min-h-36"
              placeholder={selectedMode.placeholder}
            />
            <div className="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p id="quick-capture-status" className={cn('text-[11px] text-muted-foreground', savedMessage && 'text-teal-700 dark:text-teal-300')} role="status">
                {savedMessage || '⌘/Ctrl + Enter로 빠르게 저장'}
              </p>
              <Button onClick={() => void saveCapture()} disabled={!capture.trim() || saving} className="h-11 w-full gap-1.5 rounded-full px-5 sm:h-9 sm:w-auto">
                <Send className="size-3.5" />
                {saving ? '저장 중…' : '기록 저장'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="folio-surface gap-0 border-0 py-0">
          <CardHeader className="flex-row items-center justify-between border-b border-foreground/[0.07] px-5 py-5">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">오늘 할 일</CardTitle>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{loading ? '–' : activeTasks.length}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">지금 집중할 일을 확인하세요.</p>
            </div>
            <Button variant="ghost" size="icon" className="size-8 rounded-full text-muted-foreground" onClick={() => void refresh()} aria-label="오늘 할 일 새로고침">
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </Button>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <div className="divide-y divide-foreground/[0.07]">
            {activeTasks.slice(0, 4).map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onOpenBoard(task.id)}
                className="group flex w-full items-start gap-3 px-1 py-3 text-left transition-colors hover:text-foreground"
              >
                <span className={cn('mt-0.5 size-3 shrink-0 rounded-full border-2 border-background ring-1 ring-foreground/10', task.status === 'in_progress' ? 'bg-blue-500' : task.status === 'review' ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{task.title}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {task.status === 'in_progress' ? '진행 중' : task.status === 'review' ? '검토 중' : '할 일'} · {task.priority === 'high' ? '높은 우선순위' : task.priority === 'medium' ? '보통 우선순위' : '낮은 우선순위'}
                  </span>
                </span>
                <ArrowRight className="mt-0.5 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
            </div>
            {!loading && activeTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-foreground/10 bg-muted/20 px-4 py-6 text-center">
                <CheckCircle2 className="mx-auto size-5 text-teal-600 dark:text-teal-400" />
                <p className="mt-2 text-sm font-medium">열린 할 일이 없어요</p>
                <p className="mt-1 text-[11px] text-muted-foreground">새로운 일이 생기면 여기에 추가해보세요.</p>
                <Button variant="outline" size="sm" className="mt-3 rounded-full bg-background shadow-none" onClick={() => onOpenBoard()}>
                  할 일 추가
                </Button>
              </div>
            ) : null}
            {activeTasks.length > 0 ? (
              <Button variant="ghost" size="sm" className="mt-1 w-full justify-between rounded-xl text-xs" onClick={() => onOpenBoard()}>
                일정 전체 보기
                <ArrowRight className="size-3.5" />
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <DailyReviewCard
        date={today}
        tasks={data.tasks}
        journalCount={todayEntries.length}
        initiallyExpanded={journeyPhase === 'review'}
      />

      <WeeklyReviewCard anchor={today} journals={data.journals} tasks={data.tasks} />

      <details className="folio-surface group overflow-hidden rounded-[1.35rem]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[1.35rem] px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden sm:px-6">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold">기록 보관함</h2>
            <p className="mt-1 truncate text-xs text-muted-foreground">지난 기록 {memories.length}개 · 최근 문서 {recentDocs.length}개</p>
          </div>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-6 border-t px-5 py-5 sm:px-6">
          <section aria-labelledby="memory-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 id="memory-title" className="text-xs font-semibold">지난 기록</h3>
              <span className="text-[11px] text-muted-foreground">필요한 맥락을 다시 꺼내보세요.</span>
            </div>
            {memories.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-3">
                {memories.map((memory) => (
                  <button
                    key={memory.entryKey}
                    type="button"
                    onClick={() => onOpenJournal(memory.entryKey, memory.entry.date)}
                    className="group rounded-xl border border-foreground/[0.08] bg-background p-4 text-left transition-colors hover:bg-muted/35"
                  >
                    <div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock3 className="size-3" />{memory.label}</span>
                      <span>{memory.entry.date}</span>
                    </div>
                    <h4 className="mt-3 line-clamp-1 text-sm font-semibold">{journalTitle(memory.entry.content)}</h4>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{journalExcerpt(memory.entry.content)}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-foreground/10 px-4 py-5 text-center">
                <CalendarDays className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">기록이 쌓이면 지난 기억을 꺼내드릴게요</p>
              </div>
            )}
          </section>

          {recentDocs.length > 0 ? (
            <section aria-labelledby="recent-docs-title">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 id="recent-docs-title" className="text-xs font-semibold">최근 문서</h3>
                <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs" onClick={() => onOpenDocs()}>전체 보기</Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {recentDocs.map((doc) => (
                  <button key={doc.id} type="button" onClick={() => onOpenDocs(doc.id)} className="group flex items-center gap-3 rounded-xl border border-foreground/[0.08] bg-background p-3 text-left transition-colors hover:bg-muted/35">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><FileText className="size-3.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{doc.title || '제목 없는 문서'}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{doc.category || '문서'}</span>
                    </span>
                    <ArrowRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </details>

      <div className="flex items-center justify-center gap-2 py-1 text-[11px] text-muted-foreground">
        <SunMedium className="size-3.5 text-amber-500" />
        작은 기록이 쌓여 나만의 맥락이 됩니다.
      </div>
    </div>
  )
}
