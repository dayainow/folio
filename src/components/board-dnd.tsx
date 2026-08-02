'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Search,
  CircleDot,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  Star,
  GitBranch,
} from 'lucide-react';
import { loadTasksWithFallback, saveTasksWithFallback, deleteTaskWithFallback, type Task, DEFAULT_COLUMNS } from '@/lib/board';
import { loadJournalsWithFallback } from '@/lib/journal';
import { loadFavorites, saveFavorites, toggleFavorite } from '@/lib/favorites';
import { TagCloud, buildTagCounts } from '@/components/tag-cloud';
import { recordBoardStatusChange } from '@/lib/analytics';
import { ExportMenu } from '@/components/export-menu';
import { downloadText, tasksToCsv, tasksToJson } from '@/lib/export';

const STATUS_ORDER: Task['status'][] = ['backlog', 'in_progress', 'review', 'done'];

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-900',
  low: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
};

function resolveDropStatus(overId: string | number, tasks: Task[]): Task['status'] | null {
  const id = String(overId);
  if (STATUS_ORDER.includes(id as Task['status'])) {
    return id as Task['status'];
  }
  return tasks.find(t => t.id === id)?.status ?? null;
}

function TaskCardBody({
  task,
  showActions = true,
  favorite = false,
  githubEnabled = false,
  githubBusy = false,
  onMove,
  onEdit,
  onDelete,
  onToggleFavorite,
  onCreateGithub,
}: {
  task: Task;
  showActions?: boolean;
  favorite?: boolean;
  githubEnabled?: boolean;
  githubBusy?: boolean;
  onMove?: (direction: 'left' | 'right') => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  onCreateGithub?: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium flex-1 leading-snug">{task.title}</div>
        <div className="flex items-center gap-0.5" onPointerDown={e => e.stopPropagation()}>
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFavorite}
              className="h-5 w-5"
              aria-label={favorite ? '즐겨찾기 해제' : '즐겨찾기'}
            >
              <Star
                className={`h-3.5 w-3.5 ${favorite ? 'fill-amber-400 text-amber-500' : 'text-gray-400'}`}
              />
            </Button>
          )}
          {showActions && onMove && (
            <>
              {task.status !== 'backlog' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onMove('left')}
                  className="h-5 w-5"
                  aria-label="이전 컬럼으로 이동"
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
              )}
              {task.status !== 'done' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onMove('right')}
                  className="h-5 w-5"
                  aria-label="다음 컬럼으로 이동"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {task.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <Badge variant="outline" className={`text-[10px] px-1 py-0 h-auto ${PRIORITY_COLORS[task.priority]}`}>
          <CircleDot className="h-2.5 w-2.5 inline mr-0.5" />
          {task.priority}
        </Badge>
        {task.tags.slice(0, 2).map(t => (
          <Badge key={t} variant="secondary" className="text-[10px] px-1 py-0 h-auto">#{t}</Badge>
        ))}
      </div>
      {task.jiraKey && (
        <div className="mt-2" onPointerDown={e => e.stopPropagation()}>
          <a
            href={task.jiraUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
          >
            {task.jiraKey}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      {task.githubUrl && (
        <div className="mt-1.5 space-y-1" onPointerDown={e => e.stopPropagation()}>
          <a
            href={task.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-wrap items-center gap-1 text-[11px] text-gray-700 dark:text-gray-300 hover:underline"
          >
            <GitBranch className="h-3 w-3" />
            #{task.githubIssueNumber ?? 'issue'}
            {task.githubState && (
              <span
                className={`rounded px-1 py-0.5 text-[10px] ${
                  task.githubState === 'open'
                    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                    : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                }`}
              >
                {task.githubState}
              </span>
            )}
            <ExternalLink className="h-3 w-3" />
          </a>
          {(task.githubAssignees?.length || task.githubLabels?.length) ? (
            <div className="flex flex-wrap gap-1">
              {task.githubAssignees?.slice(0, 3).map((a) => (
                <span
                  key={a}
                  className="rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  @{a}
                </span>
              ))}
              {task.githubLabels?.slice(0, 3).map((l) => (
                <span
                  key={l}
                  className="rounded bg-blue-50 px-1 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                >
                  {l}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
      {showActions && onEdit && onDelete && (
        <>
          <Separator className="my-2" />
          <div className="flex flex-wrap gap-1" onPointerDown={e => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 text-[11px]">편집</Button>
            {githubEnabled && !task.githubUrl && onCreateGithub && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCreateGithub}
                disabled={githubBusy}
                className="h-7 text-[11px] gap-1"
              >
                <GitBranch className="h-3 w-3" />
                {githubBusy ? '생성 중…' : 'GitHub'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onDelete} className="h-7 text-[11px] text-red-500">삭제</Button>
          </div>
        </>
      )}
    </>
  );
}

function DraggableTaskCard({
  task,
  favorite,
  githubEnabled,
  githubBusy,
  focused,
  onFocus,
  onMove,
  onEdit,
  onDelete,
  onToggleFavorite,
  onCreateGithub,
}: {
  task: Task;
  favorite: boolean;
  githubEnabled: boolean;
  githubBusy: boolean;
  focused: boolean;
  onFocus: () => void;
  onMove: (direction: 'left' | 'right') => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onCreateGithub: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { status: task.status },
  });

  return (
    <Card
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : undefined }}
      {...listeners}
      {...attributes}
      tabIndex={0}
      role="option"
      aria-selected={focused}
      aria-label={`${task.title}, ${task.status}${favorite ? ', 즐겨찾기' : ''}. 화살표 좌우로 컬럼 이동, 스페이스로 드래그`}
      onFocus={onFocus}
      onKeyDown={e => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onMove('left');
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          onMove('right');
        }
      }}
      className={`rounded-xl border bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing touch-none outline-none ${
        focused
          ? 'border-blue-400 ring-2 ring-blue-300 dark:ring-blue-800'
          : 'border-gray-100 dark:border-gray-700'
      }`}
    >
      <TaskCardBody
        task={task}
        favorite={favorite}
        githubEnabled={githubEnabled}
        githubBusy={githubBusy}
        onMove={onMove}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
        onCreateGithub={onCreateGithub}
      />
    </Card>
  );
}

function DroppableColumn({
  col,
  count,
  onAdd,
  children,
}: {
  col: (typeof DEFAULT_COLUMNS)[number];
  count: number;
  onAdd: () => void;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border p-3 ${col.color} dark:bg-gray-900/50 flex min-h-[12rem] flex-col transition-all xl:min-h-0 xl:max-h-[calc(100dvh-11rem)] ${
        isOver ? 'border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-gray-100 dark:border-gray-800'
      }`}
    >
      <div className="flex items-center justify-between mb-3 px-1 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{col.label}</span>
          <Badge variant="secondary" className="text-xs">{count}</Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onAdd} className="h-6 w-6" aria-label={`${col.label}에 태스크 추가`}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="min-h-[6rem] space-y-2">
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}

export function BoardDndPanel({
  focusTaskId,
  onFocusHandled,
}: {
  focusTaskId?: string | null;
  onFocusHandled?: () => void;
} = {}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [journalTagSources, setJournalTagSources] = useState<Array<{ tags: string[] }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState<{ title: string; description: string; priority: Task['priority']; tags: string; status: Task['status'] }>({ title: '', description: '', priority: 'medium', tags: '', status: 'backlog' });
  const [jiraSyncing, setJiraSyncing] = useState(false);
  const [jiraMessage, setJiraMessage] = useState<string | null>(null);
  const [githubEnabled, setGithubEnabled] = useState(false);
  const [githubSyncing, setGithubSyncing] = useState(false);
  const [notifyOnDone, setNotifyOnDone] = useState(true);
  const [hasNotifyChannel, setHasNotifyChannel] = useState(false);
  const [githubBusyId, setGithubBusyId] = useState<string | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastPersist, setLastPersist] = useState<Task[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ fetchIntegrationsStatus }, next, journals] = await Promise.all([
        import('@/lib/notify-client'),
        loadTasksWithFallback(),
        loadJournalsWithFallback().catch(() => ({}) as Record<string, { tags: string[] }>),
      ]);
      const status = await fetchIntegrationsStatus().catch(() => ({
        slack: false,
        discord: false,
        github: false,
        githubRepo: null as string | null,
      }));
      if (cancelled) return;
      setTasks(next);
      setFavorites(loadFavorites());
      setJournalTagSources(Object.values(journals).map(j => ({ tags: j.tags })));
      setGithubEnabled(status.github);
      setHasNotifyChannel(status.slack || status.discord);

      // P39 — 연결된 Issue 상태/담당자/라벨 실시간 반영
      if (status.github) {
        const nums = next
          .map((t) => t.githubIssueNumber)
          .filter((n): n is number => typeof n === 'number');
        if (nums.length > 0) {
          try {
            const res = await fetch(`/api/github/sync?numbers=${nums.join(',')}`, {
              cache: 'no-store',
            });
            if (res.ok && !cancelled) {
              const data = (await res.json()) as {
                patches?: Array<{
                  githubIssueNumber: number;
                  githubUrl: string;
                  githubState: string;
                  githubAssignees: string[];
                  githubLabels: string[];
                  suggestStatus?: 'done';
                }>;
              };
              const byNum = new Map((data.patches ?? []).map((p) => [p.githubIssueNumber, p]));
              setTasks((prev) =>
                prev.map((t) => {
                  const p = t.githubIssueNumber != null ? byNum.get(t.githubIssueNumber) : undefined;
                  if (!p) return t;
                  return {
                    ...t,
                    githubUrl: p.githubUrl || t.githubUrl,
                    githubState: p.githubState,
                    githubAssignees: p.githubAssignees,
                    githubLabels: p.githubLabels,
                    status: p.suggestStatus === 'done' && t.status !== 'done' ? 'done' : t.status,
                  };
                }),
              );
            }
          } catch {
            /* sync 실패는 UI 차단하지 않음 */
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!focusTaskId) return;
    if (tasks.length === 0) return;
    const task = tasks.find(t => t.id === focusTaskId);
    const handle = window.setTimeout(() => {
      if (task) {
        setComposing(false);
        setEditingId(task.id);
        setForm({
          title: task.title,
          description: task.description,
          priority: task.priority,
          tags: task.tags.join(', '),
          status: task.status,
        });
        setSearch('');
      }
      onFocusHandled?.();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [focusTaskId, tasks, onFocusHandled]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const persist = async (next: Task[]) => {
    setSaveError(null);
    setLastPersist(next);
    setTasks(next);
    const removed = tasks.filter(old => !next.some(n => n.id === old.id));
    try {
      for (const item of removed) {
        await deleteTaskWithFallback(item.id);
        void import('@/lib/beacon-timeline-consent').then(({ recordFolioTimelineEvent }) =>
          recordFolioTimelineEvent({
            title: `일정 삭제 · ${item.title}`,
            type: 'board_delete',
            category: 'board',
          }),
        );
      }
      await saveTasksWithFallback(next);
      void import('@/lib/beacon-timeline-consent').then(({ recordFolioTimelineEvent }) =>
        recordFolioTimelineEvent({
          title: `일정 저장 · ${next.length}건`,
          type: 'board_save',
          category: 'board',
        }),
      );
    } catch {
      setSaveError('태스크 저장에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  const resetForm = () => {
    setForm({ title: '', description: '', priority: 'medium', tags: '', status: 'backlog' });
    setEditingId(null);
    setComposing(false);
  };

  const openNewTask = (status: Task['status'] = 'backlog') => {
    setEditingId(null);
    setComposing(true);
    setForm({ title: '', description: '', priority: 'medium', tags: '', status });
  };

  const syncFromJira = async () => {
    setJiraSyncing(true);
    setJiraMessage(null);
    try {
      const res = await fetch('/api/jira/issues');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Jira 동기화 실패');
      }
      const jiraTasks = (data.tasks ?? []) as Task[];
      const byJiraKey = new Map(
        tasks.filter(t => t.jiraKey).map(t => [t.jiraKey!, t]),
      );
      const mergedJira = jiraTasks.map(jt => {
        const existing = byJiraKey.get(jt.jiraKey!);
        return existing
          ? {
              ...existing,
              title: jt.title,
              description: jt.description,
              status: jt.status,
              priority: jt.priority,
              tags: jt.tags,
              jiraKey: jt.jiraKey,
              jiraUrl: jt.jiraUrl,
              updatedAt: new Date().toISOString(),
            }
          : jt;
      });
      const nonJira = tasks.filter(t => !t.jiraKey);
      const next = [...nonJira, ...mergedJira];
      await persist(next);
      setJiraMessage(`Jira에서 ${jiraTasks.length}건 동기화했습니다.`);
      // P39 — Jira → Board 동기화 워크플로우 이벤트
      void fetch('/api/workflow/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'jira_sync',
          title: 'Jira → Board 동기화',
          message: `${jiraTasks.length}건 동기화`,
          jiraKey: jiraTasks[0]?.jiraKey,
          actionUrl: '/?tab=board',
        }),
      }).catch(() => undefined);
    } catch (err) {
      setJiraMessage(err instanceof Error ? err.message : 'Jira 동기화 실패');
    } finally {
      setJiraSyncing(false);
    }
  };

  const syncFromGitHub = async () => {
    if (!githubEnabled) return;
    setGithubSyncing(true);
    setJiraMessage(null);
    try {
      const nums = tasks
        .map((t) => t.githubIssueNumber)
        .filter((n): n is number => typeof n === 'number');
      const qs = nums.length ? `?numbers=${nums.join(',')}` : '';
      const res = await fetch(`/api/github/sync${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'GitHub 동기화 실패');
      const patches = (data.patches ?? []) as Array<{
        githubIssueNumber: number;
        githubUrl: string;
        githubState: string;
        githubAssignees: string[];
        githubLabels: string[];
        suggestStatus?: 'done';
      }>;
      const byNum = new Map(patches.map((p) => [p.githubIssueNumber, p]));
      let moved = 0;
      const next = tasks.map((t) => {
        const p = t.githubIssueNumber != null ? byNum.get(t.githubIssueNumber) : undefined;
        if (!p) return t;
        const toDone = p.suggestStatus === 'done' && t.status !== 'done';
        if (toDone) moved += 1;
        return {
          ...t,
          githubUrl: p.githubUrl || t.githubUrl,
          githubState: p.githubState,
          githubAssignees: p.githubAssignees,
          githubLabels: p.githubLabels,
          status: toDone ? ('done' as const) : t.status,
          updatedAt: new Date().toISOString(),
        };
      });
      await persist(next);
      setJiraMessage(
        `GitHub Issue ${patches.length}건 반영${moved ? ` · ${moved}건 Done` : ''}`,
      );
    } catch (err) {
      setJiraMessage(err instanceof Error ? err.message : 'GitHub 동기화 실패');
    } finally {
      setGithubSyncing(false);
    }
  };

  const setTaskStatus = async (id: string, status: Task['status']) => {
    const task = tasks.find(t => t.id === id);
    if (!task || task.status === status) return;
    recordBoardStatusChange(id, status);
    await persist(tasks.map(t => t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t));

    if (status === 'done' && notifyOnDone && hasNotifyChannel) {
      const preview = (task.description || '').trim().slice(0, 100).replace(/\s+/g, ' ');
      void import('@/lib/notify-client').then(({ notifyChannels }) =>
        notifyChannels(`✅ Folio 태스크 완료 · ${task.title}`, {
          deepLink: { tab: 'board', taskId: task.id },
          actionLabel: '확인',
          body: [
            `*태스크 완료*`,
            `• 제목: ${task.title}`,
            `• 우선순위: ${task.priority}`,
            task.tags.length ? `• 태그: ${task.tags.join(', ')}` : null,
            preview ? `• 설명: ${preview}${task.description.trim().length > 100 ? '…' : ''}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
        }),
      );
    }

    if (status === 'done') {
      void import('@/lib/activity-stream').then(({ publishActivity }) =>
        import('@/lib/presence').then(({ getOrCreateGuestId }) =>
          publishActivity({
            type: 'task_done',
            actorId: getOrCreateGuestId(),
            actorName: 'Board',
            targetKind: 'board',
            targetId: task.id,
            summary: `태스크 완료 · ${task.title}`,
          }),
        ),
      );
    }
  };

  const linkGitHubIssue = async (task: Task) => {
    if (!githubEnabled) return;
    setGithubBusyId(task.id);
    setJiraMessage(null);
    try {
      const res = await fetch('/api/github/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          body: task.description || `Created from Folio board task \`${task.id}\``,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'GitHub 이슈 생성 실패');
      const issue = data.issue as { number: number; htmlUrl: string };
      await persist(
        tasks.map(t =>
          t.id === task.id
            ? {
                ...t,
                githubIssueNumber: issue.number,
                githubUrl: issue.htmlUrl,
                githubState: 'open',
                githubAssignees: [],
                githubLabels: [],
                updatedAt: new Date().toISOString(),
              }
            : t,
        ),
      );
      setJiraMessage(`GitHub Issue #${issue.number} 연결됨`);
    } catch (err) {
      setJiraMessage(err instanceof Error ? err.message : 'GitHub 이슈 생성 실패');
    } finally {
      setGithubBusyId(null);
    }
  };

  const doSave = async () => {
    if (!form.title.trim()) return;
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (editingId) {
      await persist(tasks.map(t => t.id === editingId ? { ...t, title: form.title, description: form.description, priority: form.priority as Task['priority'], tags, updatedAt: new Date().toISOString() } : t));
    } else {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await persist([...tasks, newTask]);
    }
    resetForm();
  };

  const doEdit = (task: Task) => {
    setComposing(false);
    setEditingId(task.id);
    setForm({ title: task.title, description: task.description, priority: task.priority, tags: task.tags.join(', '), status: task.status });
  };

  const doDelete = async (id: string) => {
    await persist(tasks.filter(t => t.id !== id));
    setFavorites(prev => {
      const cleaned = prev.filter(fid => fid !== id);
      saveFavorites(cleaned);
      return cleaned;
    });
    if (editingId === id) resetForm();
  };

  const handleToggleFavorite = (id: string) => {
    setFavorites(prev => toggleFavorite(id, prev));
  };

  const move = async (id: string, direction: 'left' | 'right') => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const idx = STATUS_ORDER.indexOf(task.status);
    if (direction === 'left' && idx > 0) {
      await setTaskStatus(id, STATUS_ORDER[idx - 1]);
    }
    if (direction === 'right' && idx < STATUS_ORDER.length - 1) {
      await setTaskStatus(id, STATUS_ORDER[idx + 1]);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const nextStatus = resolveDropStatus(over.id, tasks);
    if (!nextStatus) return;
    void setTaskStatus(String(active.id), nextStatus);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const cloudTags = useMemo(() => {
    return buildTagCounts([...tasks, ...journalTagSources]);
  }, [tasks, journalTagSources]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter(t => {
      if (filterTag && !t.tags.includes(filterTag)) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    });
  }, [tasks, search, filterTag]);

  const favoriteTasks = useMemo(
    () => filtered.filter(t => favorites.includes(t.id)),
    [filtered, favorites],
  );

  const tasksByStatus = useMemo(() => {
    const map: Record<Task['status'], Task[]> = {
      backlog: [],
      in_progress: [],
      review: [],
      done: [],
    };
    for (const t of filtered) {
      map[t.status].push(t);
    }
    return map;
  }, [filtered]);

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm min-w-[180px]">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" aria-hidden />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="태스크 검색..."
            className="pl-8 h-8 text-xs"
            aria-label="태스크 검색"
          />
        </div>
        <ExportMenu
          label="내보내기"
          items={[
            {
              id: 'csv',
              label: 'CSV',
              description: 'Excel에서 열기 · boards-YYYY-MM-DD.csv',
              run: async (setProgress) => {
                setProgress(0.4, 'CSV 생성…')
                const csv = tasksToCsv(tasks)
                const day = new Date().toISOString().slice(0, 10)
                downloadText(csv, `boards-${day}.csv`, 'text/csv;charset=utf-8')
                setProgress(1, '완료')
              },
            },
            {
              id: 'json',
              label: 'JSON',
              description: '백업/마이그레이션 · boards-YYYY-MM-DD.json',
              run: async (setProgress) => {
                setProgress(0.4, 'JSON 생성…')
                const json = tasksToJson(tasks)
                const day = new Date().toISOString().slice(0, 10)
                downloadText(json, `boards-${day}.json`, 'application/json;charset=utf-8')
                setProgress(1, '완료')
              },
            },
          ]}
        />
        <Button
          onClick={() => void syncFromJira()}
          size="sm"
          variant="outline"
          disabled={jiraSyncing}
          className="gap-1"
          aria-busy={jiraSyncing}
          aria-label={jiraSyncing ? 'Jira 동기화 중' : 'Jira 동기화'}
        >
          <RefreshCw className={`h-3 w-3 ${jiraSyncing ? 'animate-spin' : ''}`} />
          {jiraSyncing ? '동기화 중…' : 'Jira 동기화'}
        </Button>
        {githubEnabled && (
          <Button
            onClick={() => void syncFromGitHub()}
            size="sm"
            variant="outline"
            disabled={githubSyncing}
            className="gap-1"
            aria-busy={githubSyncing}
            aria-label={githubSyncing ? 'GitHub 동기화 중' : 'GitHub 동기화'}
          >
            <GitBranch className={`h-3 w-3 ${githubSyncing ? 'animate-pulse' : ''}`} />
            {githubSyncing ? 'GH 동기화…' : 'GitHub 동기화'}
          </Button>
        )}
        {githubEnabled && (
          <span className="text-[11px] text-gray-400 inline-flex items-center gap-1">
            <GitBranch className="h-3.5 w-3.5" />
            GitHub 연동됨
          </span>
        )}
        {hasNotifyChannel && (
          <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyOnDone}
              onChange={e => setNotifyOnDone(e.target.checked)}
              className="rounded border-gray-300"
            />
            완료 시 알림
          </label>
        )}
        <Button
          type="button"
          onClick={() => openNewTask('backlog')}
          size="sm"
          className="gap-1 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
        >
          <Plus className="h-3 w-3" /> 새 태스크
        </Button>
      </div>

      <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-3 bg-card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300">태그 클라우드</h3>
          {filterTag && (
            <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setFilterTag(null)}>
              필터 해제
            </Button>
          )}
        </div>
        <TagCloud tags={cloudTags} selected={filterTag} onSelect={setFilterTag} />
      </Card>

      {saveError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <span className="flex-1">{saveError}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => lastPersist && void persist(lastPersist)}
          >
            다시 시도
          </Button>
        </div>
      )}

      {jiraMessage && (
        <p
          role="status"
          aria-live="polite"
          className={`text-xs ${jiraMessage.includes('실패') || jiraMessage.includes('없습니다') || jiraMessage.includes('Error') || jiraMessage.includes('Jira API') ? 'text-red-500' : 'text-gray-500'}`}
        >
          {jiraMessage}
        </p>
      )}

      {(editingId || composing) ? (
        <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 bg-card">
          <div className="space-y-3">
            <Input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="태스크 제목"
              className="h-9 text-sm"
              autoFocus
              required
              aria-required="true"
              aria-label="태스크 제목"
              aria-describedby="board-title-hint"
            />
            <p id="board-title-hint" className="text-[11px] text-muted-foreground">
              제목은 필수입니다. 저장하려면 입력하세요.
            </p>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="설명..."
              className="min-h-[60px] resize-none text-sm"
              aria-label="태스크 설명"
            />
            <div className="flex items-center gap-3">
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value as Task['priority'] })}
                className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-background"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <Input
                value={form.tags}
                onChange={e => setForm({ ...form, tags: e.target.value })}
                placeholder="태그 (쉼표 구분)"
                className="h-8 text-xs flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => void doSave()} size="sm" className="bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900">저장</Button>
              <Button type="button" size="sm" variant="ghost" onClick={resetForm}>취소</Button>
            </div>
          </div>
        </Card>
      ) : null}

      {favoriteTasks.length > 0 && (
        <Card className="rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">즐겨찾기</h3>
            <Badge variant="secondary" className="text-xs">{favoriteTasks.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            {favoriteTasks.map(task => (
              <Card
                key={`fav-${task.id}`}
                className="rounded-xl border border-gray-100 dark:border-gray-700 bg-card p-3 shadow-sm"
              >
                <TaskCardBody
                  task={task}
                  favorite
                  githubEnabled={githubEnabled}
                  githubBusy={githubBusyId === task.id}
                  onMove={direction => move(task.id, direction)}
                  onEdit={() => doEdit(task)}
                  onDelete={() => doDelete(task.id)}
                  onToggleFavorite={() => handleToggleFavorite(task.id)}
                  onCreateGithub={() => void linkGitHubIssue(task)}
                />
              </Card>
            ))}
          </div>
        </Card>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{
          announcements: {
            onDragStart({ active }) {
              return `태스크 ${String(active.id)} 드래그 시작`;
            },
            onDragOver({ active, over }) {
              return over
                ? `태스크 ${String(active.id)}가 ${String(over.id)} 위에 있음`
                : `태스크 ${String(active.id)} 드래그 중`;
            },
            onDragEnd({ active, over }) {
              return over
                ? `태스크 ${String(active.id)}를 ${String(over.id)}로 이동함`
                : `태스크 ${String(active.id)} 드래그 취소`;
            },
            onDragCancel({ active }) {
              return `태스크 ${String(active.id)} 드래그 취소`;
            },
          },
        }}
      >
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:max-h-[calc(100dvh-11rem)] xl:grid-cols-4 xl:min-h-0 xl:items-start"
          role="listbox"
          aria-label="칸반 보드. 카드 포커스 후 좌우 화살표로 컬럼 이동"
        >
          {DEFAULT_COLUMNS.map(col => {
            const colTasks = tasksByStatus[col.key];
            return (
              <DroppableColumn
                key={col.key}
                col={col}
                count={colTasks.length}
                onAdd={() => openNewTask(col.key)}
              >
                {colTasks.length === 0 && (
                  <div className="px-2 py-4 text-center text-xs text-gray-400" role="status">
                    <p className="font-medium text-gray-500 dark:text-gray-400 mb-1">비어 있음</p>
                    <p>+ 버튼으로 「{col.label}」에 태스크를 추가하세요</p>
                  </div>
                )}
                {colTasks.map(task => (
                  <DraggableTaskCard
                    key={task.id}
                    task={task}
                    favorite={favorites.includes(task.id)}
                    githubEnabled={githubEnabled}
                    githubBusy={githubBusyId === task.id}
                    focused={focusedTaskId === task.id}
                    onFocus={() => setFocusedTaskId(task.id)}
                    onMove={direction => move(task.id, direction)}
                    onEdit={() => doEdit(task)}
                    onDelete={() => doDelete(task.id)}
                    onToggleFavorite={() => handleToggleFavorite(task.id)}
                    onCreateGithub={() => void linkGitHubIssue(task)}
                  />
                ))}
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <Card className="rounded-xl border border-gray-100 dark:border-gray-700 bg-card p-3 shadow-lg rotate-1 cursor-grabbing">
              <TaskCardBody
                task={activeTask}
                showActions={false}
                favorite={favorites.includes(activeTask.id)}
              />
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
