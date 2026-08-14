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
  Lightbulb,
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
  localDateKey,
  selectMemoryMoments,
} from '@/lib/personal-assistant'
import { cn } from '@/lib/utils'
import { DailyReviewCard } from '@/components/daily-review-card'
import { loadDailyReview } from '@/lib/daily-review'
import { WeeklyReviewCard } from '@/components/weekly-review-card'
import { WeeklyFocusCard } from '@/components/weekly-focus-card'

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

  const primaryAction =
    journeyPhase === 'plan'
      ? { label: '오늘 계획 보기', icon: CalendarDays, action: () => onOpenBoard() }
      : journeyPhase === 'capture'
        ? { label: '지금 기록하기', icon: PenLine, action: focusCapture }
        : { label: '오늘 정리하기', icon: ClipboardCheck, action: () => onOpenJournal(today, today) }
  const PrimaryActionIcon = primaryAction.icon

  const journeySteps = [
    {
      id: 'plan' as const,
      eyebrow: 'START',
      title: '방향 잡기',
      status: activeTasks.length > 0 ? `${activeTasks.length}개 진행 예정` : '계획 열기',
      icon: CalendarDays,
    },
    {
      id: 'capture' as const,
      eyebrow: 'FLOW',
      title: '흐름 남기기',
      status: todayEntries.length > 0 ? `${todayEntries.length}개 기록됨` : '빠른 기록',
      icon: PenLine,
    },
    {
      id: 'review' as const,
      eyebrow: 'CLOSE',
      title: '하루 정리하기',
      status: '일지 정리',
      icon: ClipboardCheck,
    },
  ]

  const handleJourneyAction = (step: (typeof journeySteps)[number]['id']) => {
    if (step === 'plan') {
      onOpenBoard()
      return
    }
    if (step === 'capture') {
      focusCapture()
      return
    }
    onOpenJournal(today, today)
  }

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
    <div className="folio-home mx-auto w-full max-w-6xl space-y-6 pb-8">
      <section className="folio-hero relative overflow-hidden rounded-[2rem] p-6 sm:p-9">
        <div aria-hidden className="folio-hero-orbit absolute -right-14 -top-20 size-64 rounded-full" />
        <div aria-hidden className="absolute -bottom-24 left-[42%] size-52 rounded-full bg-emerald-200/15 blur-3xl dark:bg-emerald-400/5" />
        <div className="relative">
          <div>
            <div className="folio-eyebrow mb-5 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
              <Sparkles className="size-3.5" />
              나를 위한 기록 비서
            </div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground">{formatToday(now, locale)}</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold leading-[1.15] tracking-[-0.045em] sm:text-[2.75rem]">{greeting(now)}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
              오늘의 생각을 붙잡고, 해야 할 일을 살피고, 잊고 있던 기록을 다시 꺼내드릴게요.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" className="folio-primary-action h-10 gap-2 rounded-full px-5" onClick={primaryAction.action}>
                <PrimaryActionIcon className="size-3.5" />
                {primaryAction.label}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2 rounded-full border-foreground/10 bg-white/50 px-4 dark:bg-white/5"
                onClick={openIntake}
              >
                <Inbox className="size-3.5" />
                통합 수집함
              </Button>
            </div>
            <p className="mt-7 text-[11px] font-medium tracking-wide text-muted-foreground">
              오늘 기록 {loading ? '–' : todayEntries.length} · 진행할 일 {loading ? '–' : activeTasks.length} · 최근 문서 {loading ? '–' : recentDocs.length}
            </p>
            {previousReview?.tomorrow ? (
              <button type="button" onClick={primaryAction.action} className="mt-3 inline-flex max-w-2xl items-center gap-2 rounded-xl border border-teal-700/10 bg-white/45 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-white/70 dark:bg-white/5 dark:hover:bg-white/10">
                <span className="shrink-0 font-semibold text-teal-800 dark:text-teal-300">어제 정한 첫 행동</span>
                <span className="truncate text-foreground/80">{previousReview.tomorrow}</span>
                <ArrowRight className="size-3.5 shrink-0" />
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="daily-journey-title" className="folio-surface rounded-[1.5rem] p-4">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <div>
            <h2 id="daily-journey-title" className="text-sm font-semibold">오늘의 흐름</h2>
          </div>
          <p className="text-[11px] text-muted-foreground">필요한 단계만 누르세요.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {journeySteps.map((step, index) => {
            const Icon = step.icon
            const active = journeyPhase === step.id
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleJourneyAction(step.id)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'group relative rounded-xl border px-3 py-3 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600',
                  active
                    ? 'border-teal-300 bg-teal-50/80 shadow-[0_12px_30px_-24px_rgba(13,148,136,0.8)] dark:border-teal-700 dark:bg-teal-950/35'
                    : 'border-border/70 bg-background hover:bg-muted/35',
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', active ? 'bg-teal-600 text-white' : 'bg-muted text-muted-foreground group-hover:text-foreground')}>
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold tracking-[0.14em] text-muted-foreground">0{index + 1} · {step.eyebrow}</p>
                    <h3 className="mt-0.5 truncate text-xs font-semibold">{step.title}</h3>
                  </div>
                  <span className={cn('ml-auto shrink-0 rounded-full px-2 py-1 text-[9px] font-medium', active ? 'bg-teal-600 text-white' : 'bg-muted text-muted-foreground')}>
                    {active ? '지금' : step.status}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <WeeklyFocusCard date={today} tasks={data.tasks} onOpenBoard={onOpenBoard} />

      <section aria-labelledby="context-title" className="flex flex-col gap-3 rounded-[1.4rem] border border-foreground/10 bg-card/55 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Inbox className="size-4 text-teal-700 dark:text-teal-300" />
            <h2 id="context-title" className="text-sm font-semibold">연결된 업무 맥락</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{sourcedContext.length ? `${sourcedContext.length}개 최근 항목` : '준비됨'}</span>
          </div>
          {sourcedContext.length ? (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {sourcedContext.map((item) => (
                <button key={`${item.kind}-${item.id}`} type="button" className="max-w-56 truncate text-left text-xs text-muted-foreground hover:text-foreground" onClick={() => item.kind === 'doc' ? onOpenDocs(item.id) : onOpenJournal(item.id, data.journals[item.id]?.date ?? today)}>
                  <span className="font-medium text-foreground/80">{item.system}</span> · {item.title}
                </button>
              ))}
            </div>
          ) : <p className="mt-1 text-xs text-muted-foreground">Obsidian·Markdown 자료를 가져오면 오늘의 업무와 함께 기억해드려요.</p>}
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5 rounded-full" onClick={openIntake}>
          <Inbox className="size-3.5" />자료 가져오기
        </Button>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <Card className="folio-surface gap-4 border-0 py-6">
          <CardHeader className="gap-3 px-5 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Quick capture</p>
                <CardTitle className="mt-1 text-lg">지금 바로 남기기</CardTitle>
              </div>
              <Lightbulb className="size-5 text-amber-500" />
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="기록 종류">
              {CAPTURE_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setCaptureMode(mode.value)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs transition-colors',
                    captureMode === mode.value
                      ? 'bg-foreground text-background'
                      : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="px-5 sm:px-6">
            <Textarea
              ref={captureRef}
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
              className="min-h-36 resize-y border-0 bg-muted/45 px-4 py-3 text-sm leading-6 shadow-inner focus-visible:bg-background"
              placeholder={selectedMode.placeholder}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className={cn('text-[11px] text-muted-foreground', savedMessage && 'text-teal-700 dark:text-teal-300')} role="status">
                {savedMessage || '⌘/Ctrl + Enter로 빠르게 저장'}
              </p>
              <Button onClick={() => void saveCapture()} disabled={!capture.trim() || saving} className="gap-1.5 rounded-full px-5">
                <Send className="size-3.5" />
                {saving ? '저장 중…' : '새 기록 저장'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="folio-surface gap-3 border-0 py-6">
          <CardHeader className="flex-row items-center justify-between px-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Tasks</p>
              <CardTitle className="mt-1 text-lg">오늘 할 일</CardTitle>
            </div>
            <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => void refresh()} aria-label="오늘 할 일 새로고침">
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 px-5">
            {activeTasks.slice(0, 4).map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onOpenBoard(task.id)}
                className="group flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-muted/70"
              >
                <span className={cn('mt-0.5 size-2.5 shrink-0 rounded-full', task.status === 'in_progress' ? 'bg-blue-500' : task.status === 'review' ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{task.title}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {task.status === 'in_progress' ? '진행 중' : task.status === 'review' ? '검토 중' : '할 일'} · {task.priority === 'high' ? '높은 우선순위' : task.priority === 'medium' ? '보통 우선순위' : '낮은 우선순위'}
                  </span>
                </span>
                <ArrowRight className="mt-0.5 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
            {!loading && activeTasks.length === 0 ? (
              <div className="rounded-2xl bg-teal-50 p-4 text-center dark:bg-teal-950/30">
                <CheckCircle2 className="mx-auto size-5 text-teal-600" />
                <p className="mt-2 text-sm font-medium">열린 할 일이 없어요</p>
                <p className="mt-1 text-[11px] text-muted-foreground">마음 가볍게 기록에 집중해도 좋아요.</p>
              </div>
            ) : null}
            <Button variant="ghost" size="sm" className="mt-1 w-full justify-between rounded-xl text-xs" onClick={() => onOpenBoard()}>
              일정 전체 보기
              <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <DailyReviewCard
        date={today}
        completedTasks={data.tasks.filter((task) => task.status === 'done').length}
        journalCount={todayEntries.length}
      />

      <WeeklyReviewCard anchor={today} journals={data.journals} tasks={data.tasks} />

      <details className="folio-surface group rounded-[1.5rem]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden sm:p-5">
          <div>
            <h2 className="text-sm font-semibold">지난 기록 돌아보기</h2>
            <p className="mt-1 text-xs text-muted-foreground">필요할 때만 과거의 맥락을 펼쳐보세요.</p>
          </div>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t p-4 sm:p-5">
        {memories.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3">
            {memories.map((memory, index) => (
              <button
                key={memory.entryKey}
                type="button"
                onClick={() => onOpenJournal(memory.entryKey, memory.entry.date)}
                className={cn(
                  'group min-h-44 overflow-hidden rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg',
                  index === 0
                    ? 'border-amber-200/70 bg-amber-50/70 dark:border-amber-800/40 dark:bg-amber-950/20'
                    : index === 1
                      ? 'border-violet-200/70 bg-violet-50/60 dark:border-violet-800/40 dark:bg-violet-950/20'
                      : 'border-sky-200/70 bg-sky-50/60 dark:border-sky-800/40 dark:bg-sky-950/20',
                )}
              >
                <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3.5" /> {memory.label}
                  </span>
                  <span>{memory.entry.date}</span>
                </div>
                <h3 className="mt-5 line-clamp-2 text-base font-semibold leading-6">{journalTitle(memory.entry.content)}</h3>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{journalExcerpt(memory.entry.content)}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium opacity-70 transition-opacity group-hover:opacity-100">
                  다시 읽기 <ArrowRight className="size-3.5" />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-7 text-center">
            <CalendarDays className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">기록이 쌓이면 지난 기억을 꺼내드릴게요</p>
            <p className="mt-1 text-xs text-muted-foreground">오늘부터 짧게라도 남겨보세요.</p>
          </div>
        )}
        </div>
      </details>

      {recentDocs.length > 0 ? (
        <section className="rounded-2xl border bg-muted/20 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">최근 이어서 볼 문서</h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onOpenDocs()}>
              전체 보기
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {recentDocs.map((doc) => (
              <button key={doc.id} type="button" onClick={() => onOpenDocs(doc.id)} className="group flex items-center gap-3 rounded-xl bg-background p-3 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted/40">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                  <FileText className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{doc.title || '제목 없는 문서'}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{doc.category || '문서'}</span>
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex items-center justify-center gap-2 py-1 text-[11px] text-muted-foreground">
        <SunMedium className="size-3.5 text-amber-500" />
        작은 기록이 쌓여 나만의 맥락이 됩니다.
      </div>
    </div>
  )
}
