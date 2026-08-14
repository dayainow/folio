'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileText,
  FolderKanban,
  Link2,
  ListTodo,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { loadJournalsWithFallback, type JournalEntry } from '@/lib/journal'
import { loadDocsWithFallback, type DocEntry } from '@/lib/docs'
import { loadTasksWithFallback, type Task } from '@/lib/board'
import {
  PROJECT_COLORS,
  createProject,
  deleteProjectWithFallback,
  loadProjectsWithFallback,
  saveProjectsWithFallback,
  toggleProjectLink,
  type ProjectStatus,
  type WorkProject,
} from '@/lib/projects'
import { journalExcerpt, journalTitle } from '@/lib/personal-assistant'
import { cn } from '@/lib/utils'

type HubData = {
  projects: WorkProject[]
  journals: Record<string, JournalEntry>
  docs: DocEntry[]
  tasks: Task[]
}

const EMPTY_DATA: HubData = { projects: [], journals: {}, docs: [], tasks: [] }

const STATUS_META: Record<ProjectStatus, { label: string; className: string }> = {
  planned: { label: '계획', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  active: { label: '진행 중', className: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200' },
  on_hold: { label: '보류', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  completed: { label: '완료', className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' },
}

const COLOR_CLASS: Record<string, string> = {
  teal: 'bg-teal-500',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-500',
}

function formatDate(date: string | null): string {
  if (!date) return '날짜 없음'
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(
    new Date(`${date}T12:00:00`),
  )
}

export function ProjectHub({
  onOpenJournal,
  onOpenDoc,
  onOpenTask,
}: {
  onOpenJournal: (entryKey: string) => void
  onOpenDoc: (docId: string) => void
  onOpenTask: (taskId: string) => void
}) {
  const [data, setData] = useState<HubData>(EMPTY_DATA)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [linking, setLinking] = useState(false)
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [color, setColor] = useState<string>('teal')
  const skipNextRefresh = useRef(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [projects, journals, docs, tasks] = await Promise.all([
        loadProjectsWithFallback(),
        loadJournalsWithFallback(),
        loadDocsWithFallback(),
        loadTasksWithFallback(),
      ])
      setData({ projects, journals, docs, tasks })
      setSelectedId((current) =>
        projects.some((project) => project.id === current) ? current : projects[0]?.id ?? null,
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    const onChange = () => {
      if (skipNextRefresh.current) {
        skipNextRefresh.current = false
        return
      }
      void refresh()
    }
    window.addEventListener('folio-projects-changed', onChange)
    return () => {
      window.clearTimeout(initial)
      window.removeEventListener('folio-projects-changed', onChange)
    }
  }, [refresh])

  const selected = data.projects.find((project) => project.id === selectedId) ?? null
  const linkedJournals = useMemo(
    () =>
      selected
        ? selected.journalKeys
            .map((key) => [key, data.journals[key]] as const)
            .filter((item): item is readonly [string, JournalEntry] => Boolean(item[1]))
        : [],
    [selected, data.journals],
  )
  const linkedDocs = useMemo(
    () => (selected ? data.docs.filter((doc) => selected.docIds.includes(doc.id)) : []),
    [selected, data.docs],
  )
  const linkedTasks = useMemo(
    () => (selected ? data.tasks.filter((task) => selected.taskIds.includes(task.id)) : []),
    [selected, data.tasks],
  )
  const completedTasks = linkedTasks.filter((task) => task.status === 'done').length
  const progress = linkedTasks.length ? Math.round((completedTasks / linkedTasks.length) * 100) : 0
  const normalizedQuery = query.trim().toLowerCase()

  const persistProjects = async (projects: WorkProject[]) => {
    setData((current) => ({ ...current, projects }))
    skipNextRefresh.current = true
    await saveProjectsWithFallback(projects)
  }

  const submitProject = async () => {
    if (!name.trim()) return
    const project = createProject({
      name,
      description,
      color,
      dueDate: dueDate || null,
    })
    await persistProjects([project, ...data.projects])
    setSelectedId(project.id)
    setCreating(false)
    setName('')
    setDescription('')
    setDueDate('')
  }

  const updateSelected = async (patch: Partial<WorkProject>) => {
    if (!selected) return
    const next = data.projects.map((project) =>
      project.id === selected.id
        ? { ...project, ...patch, updatedAt: new Date().toISOString() }
        : project,
    )
    await persistProjects(next)
  }

  const toggleLink = async (kind: 'journal' | 'doc' | 'task', targetId: string) => {
    if (!selected) return
    const updated = toggleProjectLink(selected, kind, targetId)
    await persistProjects(
      data.projects.map((project) => (project.id === selected.id ? updated : project)),
    )
  }

  const removeSelected = async () => {
    if (!selected || !window.confirm(`「${selected.name}」 프로젝트를 삭제할까요? 연결된 원본 자료는 삭제되지 않습니다.`)) return
    skipNextRefresh.current = true
    await deleteProjectWithFallback(selected.id)
    const next = data.projects.filter((project) => project.id !== selected.id)
    setData((current) => ({ ...current, projects: next }))
    setSelectedId(next[0]?.id ?? null)
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Workspace</p>
            <h1 className="mt-1 text-lg font-semibold">프로젝트</h1>
          </div>
          <Button size="icon" className="size-9 rounded-full" onClick={() => setCreating(true)} aria-label="프로젝트 만들기">
            <Plus className="size-4" />
          </Button>
        </div>

        {creating ? (
          <Card className="gap-3 py-4">
            <CardContent className="space-y-3 px-4">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="프로젝트 이름" autoFocus />
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="목표나 배경을 짧게 적어보세요" rows={3} />
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label="목표일" />
              <div className="flex gap-2" aria-label="프로젝트 색상">
                {PROJECT_COLORS.map((item) => (
                  <button key={item} type="button" onClick={() => setColor(item)} className={cn('size-6 rounded-full ring-offset-2', COLOR_CLASS[item], color === item && 'ring-2 ring-foreground')} aria-label={`${item} 색상`} />
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>취소</Button>
                <Button size="sm" disabled={!name.trim()} onClick={() => void submitProject()}>만들기</Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-1">
          {data.projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => {
                setSelectedId(project.id)
                setLinking(false)
              }}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                selectedId === project.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <span className={cn('mt-1 size-2.5 shrink-0 rounded-full', COLOR_CLASS[project.color] ?? COLOR_CLASS.teal)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{project.name}</span>
                <span className="mt-1 block text-[11px]">{STATUS_META[project.status].label} · 자료 {project.journalKeys.length + project.docIds.length + project.taskIds.length}개</span>
              </span>
            </button>
          ))}
          {!loading && data.projects.length === 0 ? (
            <button type="button" onClick={() => setCreating(true)} className="w-full rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground hover:bg-muted/30">
              <FolderKanban className="mx-auto mb-2 size-5" />
              첫 프로젝트 만들기
            </button>
          ) : null}
        </div>
      </aside>

      <main className="min-w-0">
        {selected ? (
          <div className="space-y-4">
            <section className="relative overflow-hidden rounded-[1.5rem] border bg-[linear-gradient(135deg,rgba(240,253,250,.8),rgba(255,255,255,.98)_60%)] p-5 dark:bg-[linear-gradient(135deg,rgba(19,50,46,.55),rgba(12,18,26,.98)_60%)] sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('size-3 rounded-full', COLOR_CLASS[selected.color] ?? COLOR_CLASS.teal)} />
                    <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', STATUS_META[selected.status].className)}>{STATUS_META[selected.status].label}</span>
                    {selected.dueDate ? <span className="text-xs text-muted-foreground">목표일 {formatDate(selected.dueDate)}</span> : null}
                  </div>
                  <h2 className="mt-3 truncate text-2xl font-semibold tracking-tight">{selected.name}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{selected.description || '프로젝트 목표와 배경을 추가해 보세요.'}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <select value={selected.status} onChange={(event) => void updateSelected({ status: event.target.value as ProjectStatus })} className="h-9 rounded-lg border bg-background px-3 text-xs">
                    {Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                  </select>
                  <Button variant={linking ? 'secondary' : 'outline'} size="sm" className="gap-1.5" onClick={() => setLinking((value) => !value)}>
                    <Link2 className="size-3.5" /> 자료 연결
                  </Button>
                  <Button variant="ghost" size="icon" className="size-9" onClick={() => void removeSelected()} aria-label="프로젝트 삭제">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: '일지', value: linkedJournals.length, icon: BookOpen },
                  { label: '문서', value: linkedDocs.length, icon: FileText },
                  { label: '일정', value: linkedTasks.length, icon: ListTodo },
                  { label: '완료율', value: `${progress}%`, icon: CheckCircle2 },
                ].map((item) => {
                  const Icon = item.icon
                  return <div key={item.label} className="rounded-xl border bg-background/70 p-3"><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className="size-3.5" />{item.label}</div><p className="mt-1 text-xl font-semibold">{item.value}</p></div>
                })}
              </div>
            </section>

            {linking ? (
              <Card className="gap-3 py-4">
                <CardHeader className="px-4 sm:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div><CardTitle>자료 연결</CardTitle><p className="mt-1 text-xs text-muted-foreground">원본을 이동하지 않고 이 프로젝트에 연결합니다.</p></div>
                    <Button variant="ghost" size="sm" onClick={() => setLinking(false)}>완료</Button>
                  </div>
                  <div className="relative mt-2"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="일지, 문서, 일정 검색" className="pl-9" /></div>
                </CardHeader>
                <CardContent className="grid gap-4 px-4 sm:px-5 md:grid-cols-3">
                  <LinkGroup title="일지" icon={BookOpen} items={Object.entries(data.journals).filter(([, entry]) => !normalizedQuery || entry.content.toLowerCase().includes(normalizedQuery)).slice(0, 8).map(([key, entry]) => ({ id: key, title: journalTitle(entry.content), meta: entry.date, checked: selected.journalKeys.includes(key) }))} onToggle={(id) => void toggleLink('journal', id)} />
                  <LinkGroup title="문서" icon={FileText} items={data.docs.filter((doc) => !normalizedQuery || `${doc.title} ${doc.content}`.toLowerCase().includes(normalizedQuery)).slice(0, 8).map((doc) => ({ id: doc.id, title: doc.title, meta: doc.category, checked: selected.docIds.includes(doc.id) }))} onToggle={(id) => void toggleLink('doc', id)} />
                  <LinkGroup title="일정" icon={ListTodo} items={data.tasks.filter((task) => !normalizedQuery || `${task.title} ${task.description}`.toLowerCase().includes(normalizedQuery)).slice(0, 8).map((task) => ({ id: task.id, title: task.title, meta: STATUS_META[task.status === 'done' ? 'completed' : task.status === 'backlog' ? 'planned' : 'active'].label, checked: selected.taskIds.includes(task.id) }))} onToggle={(id) => void toggleLink('task', id)} />
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              <ResourceCard title="연결된 일지" icon={BookOpen} empty="이 프로젝트의 일지를 연결해 보세요.">
                {linkedJournals.slice(0, 5).map(([key, entry]) => <ResourceRow key={key} title={journalTitle(entry.content)} meta={`${entry.date} · ${journalExcerpt(entry.content, 55)}`} onClick={() => onOpenJournal(key)} />)}
              </ResourceCard>
              <ResourceCard title="연결된 문서" icon={FileText} empty="기획서, 회의록, 설계 문서를 연결해 보세요.">
                {linkedDocs.slice(0, 5).map((doc) => <ResourceRow key={doc.id} title={doc.title} meta={doc.category} onClick={() => onOpenDoc(doc.id)} />)}
              </ResourceCard>
              <ResourceCard title="일정과 할 일" icon={CalendarDays} empty="프로젝트의 할 일과 마감 일정을 연결해 보세요.">
                {linkedTasks.slice(0, 6).map((task) => <ResourceRow key={task.id} title={task.title} meta={`${task.status === 'done' ? '완료' : task.status === 'in_progress' ? '진행 중' : task.status === 'review' ? '검토 중' : '할 일'} · ${task.priority}`} done={task.status === 'done'} onClick={() => onOpenTask(task.id)} />)}
              </ResourceCard>
              <Card className="gap-3 py-4">
                <CardHeader className="px-4 sm:px-5"><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-violet-500" />프로젝트 맥락</CardTitle></CardHeader>
                <CardContent className="space-y-3 px-4 text-sm sm:px-5">
                  <p className="leading-6 text-muted-foreground">일지 {linkedJournals.length}개, 문서 {linkedDocs.length}개, 일정 {linkedTasks.length}개가 하나의 업무 맥락으로 연결되어 있습니다.</p>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} /></div>
                  <p className="text-xs text-muted-foreground">완료한 일정 {completedTasks}/{linkedTasks.length}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[30rem] flex-col items-center justify-center rounded-[1.5rem] border border-dashed p-8 text-center">
            <FolderKanban className="size-10 text-teal-600" />
            <h2 className="mt-4 text-xl font-semibold">업무를 하나의 맥락으로 묶어보세요</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">프로젝트를 만들고 관련 일지, 문서, 일정을 연결하면 진행 상황을 한 화면에서 관리할 수 있습니다.</p>
            <Button className="mt-5 gap-1.5" onClick={() => setCreating(true)}><Plus className="size-4" />첫 프로젝트 만들기</Button>
          </div>
        )}
      </main>
    </div>
  )
}

function LinkGroup({ title, icon: Icon, items, onToggle }: { title: string; icon: typeof BookOpen; items: Array<{ id: string; title: string; meta: string; checked: boolean }>; onToggle: (id: string) => void }) {
  return <section><h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><Icon className="size-3.5" />{title}</h3><div className="max-h-64 space-y-1 overflow-y-auto">{items.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-muted/60"><input type="checkbox" checked={item.checked} onChange={() => onToggle(item.id)} className="mt-0.5" /><span className="min-w-0"><span className="block truncate text-xs font-medium">{item.title}</span><span className="block truncate text-[10px] text-muted-foreground">{item.meta}</span></span></label>)}{items.length === 0 ? <p className="py-3 text-center text-[11px] text-muted-foreground">검색 결과 없음</p> : null}</div></section>
}

function ResourceCard({ title, icon: Icon, empty, children }: { title: string; icon: typeof BookOpen; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return <Card className="gap-3 py-4"><CardHeader className="px-4 sm:px-5"><CardTitle className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" />{title}</CardTitle></CardHeader><CardContent className="space-y-1 px-3 sm:px-4">{hasChildren ? children : <p className="rounded-xl bg-muted/40 p-4 text-center text-xs text-muted-foreground">{empty}</p>}</CardContent></Card>
}

function ResourceRow({ title, meta, done, onClick }: { title: string; meta: string; done?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left hover:bg-muted/60"><span className={cn('size-2 shrink-0 rounded-full bg-slate-300', done && 'bg-teal-500')} /><span className="min-w-0 flex-1"><span className={cn('block truncate text-sm font-medium', done && 'text-muted-foreground line-through')}>{title}</span><span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{meta}</span></span><ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" /></button>
}
