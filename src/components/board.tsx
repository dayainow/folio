'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
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
} from 'lucide-react';
import { loadTasksWithFallback, saveTasksWithFallback, deleteTaskWithFallback, type Task, DEFAULT_COLUMNS } from '@/lib/board';
import { loadJournalsWithFallback } from '@/lib/journal';
import { loadFavorites, saveFavorites, toggleFavorite } from '@/lib/favorites';
import { TagCloud, buildTagCounts } from '@/components/tag-cloud';
import { recordBoardStatusChange } from '@/lib/analytics';

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
  onMove,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  task: Task;
  showActions?: boolean;
  favorite?: boolean;
  onMove?: (direction: 'left' | 'right') => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
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
                <Button variant="ghost" size="icon" onClick={() => onMove('left')} className="h-5 w-5">
                  <ChevronUp className="h-3 w-3" />
                </Button>
              )}
              {task.status !== 'done' && (
                <Button variant="ghost" size="icon" onClick={() => onMove('right')} className="h-5 w-5">
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
      {showActions && onEdit && onDelete && (
        <>
          <Separator className="my-2" />
          <div className="flex gap-1" onPointerDown={e => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 text-[11px]">편집</Button>
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
  onMove,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  task: Task;
  favorite: boolean;
  onMove: (direction: 'left' | 'right') => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
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
      className="rounded-xl border border-gray-100 dark:border-gray-700 bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing touch-none"
    >
      <TaskCardBody
        task={task}
        favorite={favorite}
        onMove={onMove}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
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
      className={`rounded-2xl border p-3 ${col.color} dark:bg-gray-900/50 min-h-[400px] flex flex-col transition-all ${
        isOver ? 'border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-gray-100 dark:border-gray-800'
      }`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{col.label}</span>
          <Badge variant="secondary" className="text-xs">{count}</Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onAdd} className="h-6 w-6">
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2 min-h-[320px]">
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}

export function BoardPanel({
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState<{ title: string; description: string; priority: Task['priority']; tags: string; status: Task['status'] }>({ title: '', description: '', priority: 'medium', tags: '', status: 'backlog' });
  const [jiraSyncing, setJiraSyncing] = useState(false);
  const [jiraMessage, setJiraMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [next, journals] = await Promise.all([
        loadTasksWithFallback(),
        loadJournalsWithFallback().catch(() => ({})),
      ]);
      if (cancelled) return;
      setTasks(next);
      setFavorites(loadFavorites());
      setJournalTagSources(Object.values(journals).map(j => ({ tags: j.tags })));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!focusTaskId) return;
    if (tasks.length === 0) return;
    const task = tasks.find(t => t.id === focusTaskId);
    if (task) {
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
  }, [focusTaskId, tasks, onFocusHandled]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const persist = async (next: Task[]) => {
    const removed = tasks.filter(old => !next.some(n => n.id === old.id));
    for (const item of removed) {
      await deleteTaskWithFallback(item.id);
    }
    await saveTasksWithFallback(next);
    setTasks(next);
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
    } catch (err) {
      setJiraMessage(err instanceof Error ? err.message : 'Jira 동기화 실패');
    } finally {
      setJiraSyncing(false);
    }
  };

  const setTaskStatus = async (id: string, status: Task['status']) => {
    const task = tasks.find(t => t.id === id);
    if (!task || task.status === status) return;
    recordBoardStatusChange(id, status);
    await persist(tasks.map(t => t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t));
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
    setForm({ title: '', description: '', priority: 'medium', tags: '', status: 'backlog' });
    setEditingId(null);
  };

  const doEdit = (task: Task) => {
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
    if (editingId === id) setEditingId(null);
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

  const filtered = tasks.filter(t => {
    if (filterTag && !t.tags.some(tag => tag === filterTag)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some(tag => tag.toLowerCase().includes(q));
  });

  const favoriteTasks = filtered.filter(t => favorites.includes(t.id));
  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm min-w-[180px]">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="태스크 검색..." className="pl-8 h-8 text-xs" />
        </div>
        <Button
          onClick={() => void syncFromJira()}
          size="sm"
          variant="outline"
          disabled={jiraSyncing}
          className="gap-1"
        >
          <RefreshCw className={`h-3 w-3 ${jiraSyncing ? 'animate-spin' : ''}`} />
          {jiraSyncing ? '동기화 중…' : 'Jira 동기화'}
        </Button>
        <Button onClick={() => { setForm({ ...form, status: 'backlog' }); setEditingId(null); }} size="sm" className="gap-1 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
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

      {jiraMessage && (
        <p className={`text-xs ${jiraMessage.includes('실패') || jiraMessage.includes('없습니다') || jiraMessage.includes('Error') || jiraMessage.includes('Jira API') ? 'text-red-500' : 'text-gray-500'}`}>
          {jiraMessage}
        </p>
      )}

      {editingId || form.title ? (
        <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 bg-card">
          <div className="space-y-3">
            <Input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="태스크 제목"
              className="h-9 text-sm"
            />
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="설명..."
              className="min-h-[60px] resize-none text-sm"
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
              <Button onClick={doSave} size="sm" className="bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900">저장</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setForm({ title: '', description: '', priority: 'medium', tags: '', status: 'backlog' }); }}>취소</Button>
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
                  onMove={direction => move(task.id, direction)}
                  onEdit={() => doEdit(task)}
                  onDelete={() => doDelete(task.id)}
                  onToggleFavorite={() => handleToggleFavorite(task.id)}
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
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {DEFAULT_COLUMNS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.key);
            return (
              <DroppableColumn
                key={col.key}
                col={col}
                count={colTasks.length}
                onAdd={() => { setForm({ ...form, status: col.key }); setEditingId(null); }}
              >
                {colTasks.length === 0 && (
                  <div className="px-2 py-6 text-center text-xs text-gray-400">태스크 없음</div>
                )}
                {colTasks.map(task => (
                  <DraggableTaskCard
                    key={task.id}
                    task={task}
                    favorite={favorites.includes(task.id)}
                    onMove={direction => move(task.id, direction)}
                    onEdit={() => doEdit(task)}
                    onDelete={() => doDelete(task.id)}
                    onToggleFavorite={() => handleToggleFavorite(task.id)}
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
