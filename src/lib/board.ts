'use client';

/**
 * Board(칸반) 태스크 CRUD — 로컬 · Supabase · storage 폴백. Jira/GitHub 확장 필드 포함.
 */
import { requireAuthUser } from '@/lib/supabase';
import { getStorageMode, loadWithFallback, saveWithFallback } from '@/lib/storage';
import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache';
import { cachedQuery, invalidateQueryCache } from '@/lib/query-cache';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  jiraKey?: string;
  jiraUrl?: string;
  githubIssueNumber?: number;
  githubUrl?: string;
  /** P39 — GitHub Issue 실시간 메타 */
  githubState?: string;
  githubAssignees?: string[];
  githubLabels?: string[];
}

const STORAGE_KEY = 'workspace_tasks';
const SUPABASE_CACHE_KEY = 'supabase:boards';

const DEFAULT_COLUMNS: { key: Task['status']; label: string; color: string }[] = [
  { key: 'backlog', label: 'Backlog', color: 'bg-gray-100' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-blue-50' },
  { key: 'review', label: 'Review', color: 'bg-yellow-50' },
  { key: 'done', label: 'Done', color: 'bg-green-50' },
];

type BoardRow = {
  id: string;
  title: string;
  description: string | null;
  status: Task['status'];
  priority: Task['priority'];
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

function rowToTask(row: BoardRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    priority: row.priority,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function taskToRow(task: Task, userId: string) {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    tags: task.tags,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

export function loadTasks(): Task[] {
  return getLocalJson<Task[]>(STORAGE_KEY, []);
}

export function saveTasks(tasks: Task[]) {
  setLocalJson(STORAGE_KEY, tasks);
  flushLocalJson(STORAGE_KEY);
}

export { DEFAULT_COLUMNS };

/** Supabase `boards` — 현재 user_id만 조회 (5분 TTL) */
export async function loadTasksSupabase(): Promise<Task[]> {
  return cachedQuery(SUPABASE_CACHE_KEY, async () => {
    const { supabase, userId } = await requireAuthUser();
    const { data, error } = await supabase
      .from('boards')
      .select('id, title, description, status, priority, tags, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return ((data ?? []) as BoardRow[]).map(rowToTask);
  });
}

/** Supabase `boards` — user_id 포함 upsert */
export async function saveTasksSupabase(tasks: Task[]) {
  const { supabase, userId } = await requireAuthUser();
  const now = new Date().toISOString();
  const rows = tasks.map(t =>
    taskToRow(
      {
        ...t,
        updatedAt: t.updatedAt || now,
        createdAt: t.createdAt || now,
      },
      userId,
    ),
  );

  const { error } = await supabase.from('boards').upsert(rows, { onConflict: 'id' });

  if (error) throw error;
  invalidateQueryCache(SUPABASE_CACHE_KEY);
}

/** Supabase `boards` — 단일 태스크 upsert */
export async function saveTaskSupabase(task: Task) {
  return saveTasksSupabase([task]);
}

/** Supabase `boards` — 본인 레코드만 삭제 */
export async function deleteTaskSupabase(id: string) {
  const { supabase, userId } = await requireAuthUser();
  const { error } = await supabase.from('boards').delete().eq('id', id).eq('user_id', userId);

  if (error) throw error;
  invalidateQueryCache(SUPABASE_CACHE_KEY);
}

export async function saveTasksWithFallback(tasks: Task[]) {
  const result = await saveWithFallback(tasks, 'board', {
    localSave: () => saveTasks(tasks),
    cloudSave: async () => {
      await saveTasksSupabase(tasks);
    },
  });
  if (result.usedFallback) {
    void import('@/lib/health-monitor').then(({ alertRemoteSaveFailure }) =>
      alertRemoteSaveFailure('board', result.mode),
    );
  }
  return result;
}

export async function deleteTaskWithFallback(id: string) {
  const next = loadTasks().filter(t => t.id !== id);
  const result = await saveWithFallback(next, 'board', {
    localSave: () => saveTasks(next),
    cloudSave: async () => {
      await deleteTaskSupabase(id);
    },
  });
  if (result.usedFallback) {
    void import('@/lib/health-monitor').then(({ alertRemoteSaveFailure }) =>
      alertRemoteSaveFailure('board', result.mode),
    );
  }
  return result;
}

/** 저장 모드에 따라 로드. 클라우드 시 로컬 Jira/GitHub 필드 병합 */
export async function loadTasksWithFallback(): Promise<Task[]> {
  const mode = getStorageMode();
  const local = loadTasks();

  if (mode === 'cloud') {
    try {
      const cloud = await loadTasksSupabase();
      const localById = new Map(local.map(t => [t.id, t]));
      return cloud.map(t => {
        const loc = localById.get(t.id);
        if (!loc) return t;
        return {
          ...t,
          jiraKey: t.jiraKey ?? loc.jiraKey,
          jiraUrl: t.jiraUrl ?? loc.jiraUrl,
          githubIssueNumber: loc.githubIssueNumber ?? t.githubIssueNumber,
          githubUrl: loc.githubUrl ?? t.githubUrl,
        };
      });
    } catch {
      return local;
    }
  }

  return loadWithFallback({
    type: 'board',
    localLoad: loadTasks,
    emptyBeacon: [],
  });
}
