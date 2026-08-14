'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  Lightbulb,
  ListTodo,
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
  journalExcerpt,
  journalTitle,
  localDateKey,
  selectMemoryMoments,
} from '@/lib/personal-assistant'
import { cn } from '@/lib/utils'

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
  onOpenProjects,
}: {
  onOpenJournal: (entryKey: string, date: string) => void
  onOpenDocs: (docId?: string) => void
  onOpenBoard: (taskId?: string) => void
  onOpenProjects: () => void
}) {
  const { locale } = useI18n()
  const [now] = useState(() => new Date())
  const [data, setData] = useState<DashboardData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [captureMode, setCaptureMode] = useState<CaptureMode>('memo')
  const [capture, setCapture] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')

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
    return () => {
      window.clearTimeout(initialRefresh)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('folio-journals-changed', onDataChange)
    }
  }, [refresh])

  const today = localDateKey(now)
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
  const memories = useMemo(() => selectMemoryMoments(data.journals, now), [data.journals, now])
  const selectedMode = CAPTURE_MODES.find((mode) => mode.value === captureMode) ?? CAPTURE_MODES[0]!

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
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-6">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-teal-900/10 bg-[linear-gradient(135deg,rgba(240,253,250,0.96),rgba(255,255,255,0.98)_48%,rgba(239,246,255,0.94))] p-5 shadow-[0_18px_60px_-38px_rgba(15,118,110,0.45)] dark:border-teal-300/10 dark:bg-[linear-gradient(135deg,rgba(17,40,38,0.96),rgba(12,18,26,0.98)_52%,rgba(17,31,45,0.96))] sm:p-7">
        <div aria-hidden className="absolute -right-12 -top-16 size-48 rounded-full bg-teal-300/20 blur-3xl" />
        <div aria-hidden className="absolute -bottom-20 left-1/3 size-44 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-teal-700/10 bg-white/65 px-3 py-1 text-[11px] font-medium text-teal-800 shadow-sm backdrop-blur dark:bg-white/5 dark:text-teal-200">
              <Sparkles className="size-3.5" />
              나를 위한 기록 비서
            </div>
            <p className="text-sm text-muted-foreground">{formatToday(now, locale)}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{greeting(now)}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              오늘의 생각을 붙잡고, 해야 할 일을 살피고, 잊고 있던 기록을 다시 꺼내드릴게요.
            </p>
            <Button variant="outline" size="sm" className="mt-4 gap-1.5 rounded-full bg-white/60 dark:bg-white/5" onClick={onOpenProjects}>
              <FolderKanban className="size-3.5" />
              프로젝트 허브 열기
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[24rem]">
            {[
              { label: '오늘 기록', value: todayEntries.length, icon: BookOpen },
              { label: '진행할 일', value: activeTasks.length, icon: ListTodo },
              { label: '최근 문서', value: recentDocs.length, icon: FileText },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-2xl border border-white/70 bg-white/60 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Icon className="size-3.5" />
                    {item.label}
                  </div>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{loading ? '–' : item.value}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <Card className="gap-4 border-0 py-5 shadow-[0_16px_45px_-32px_rgba(15,23,42,0.5)] ring-1 ring-foreground/10">
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

        <Card className="gap-3 border-0 py-5 ring-1 ring-foreground/10">
          <CardHeader className="flex-row items-center justify-between px-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Today</p>
              <CardTitle className="mt-1 text-lg">오늘의 흐름</CardTitle>
            </div>
            <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => void refresh()} aria-label="오늘의 흐름 새로고침">
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

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Memory resurfacing</p>
            <h2 className="mt-1 text-lg font-semibold">다시 꺼내볼 기억</h2>
            <p className="mt-1 text-xs text-muted-foreground">지나간 기록에서 지금의 나에게 필요한 맥락을 찾아보세요.</p>
          </div>
          <Button variant="ghost" size="sm" className="hidden gap-1 text-xs sm:inline-flex" onClick={() => onOpenJournal(today, today)}>
            일지 열기 <ArrowRight className="size-3.5" />
          </Button>
        </div>
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
      </section>

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
