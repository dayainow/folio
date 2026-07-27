'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase';

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
}

const STORAGE_KEY = 'workspace_tasks';

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

async function requireUserId() {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Supabase 로그인이 필요합니다.');
  return { supabase, userId: data.user.id };
}

export function loadTasks(): Task[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export { DEFAULT_COLUMNS };

/** Supabase `boards` 테이블에서 태스크 목록을 불러온다 */
export async function loadTasksSupabase(): Promise<Task[]> {
  const { supabase } = await requireUserId();
  const { data, error } = await supabase
    .from('boards')
    .select('id, title, description, status, priority, tags, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('loadTasksSupabase:', error.message);
    throw error;
  }

  return ((data ?? []) as BoardRow[]).map(rowToTask);
}

/** Supabase `boards` 테이블에 태스크 목록을 upsert한다 */
export async function saveTasksSupabase(tasks: Task[]) {
  const { supabase, userId } = await requireUserId();
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

  if (error) {
    console.error('saveTasksSupabase:', error.message);
    throw error;
  }
}

/** Supabase `boards` 테이블에 단일 태스크를 upsert한다 */
export async function saveTaskSupabase(task: Task) {
  return saveTasksSupabase([task]);
}

/** Supabase `boards` 테이블에서 태스크를 삭제한다 */
export async function deleteTaskSupabase(id: string) {
  const { supabase } = await requireUserId();
  const { error } = await supabase.from('boards').delete().eq('id', id);

  if (error) {
    console.error('deleteTaskSupabase:', error.message);
    throw error;
  }
}

export async function saveTaskWithFallback(task: Task) {
  try {
    await saveTaskSupabase(task);
  } catch (err) {
    console.warn('saveTaskWithFallback → localStorage', err);
    const all = loadTasks();
    const idx = all.findIndex(t => t.id === task.id);
    if (idx >= 0) all[idx] = task;
    else all.push(task);
    saveTasks(all);
  }
}

export async function saveTasksWithFallback(tasks: Task[]) {
  try {
    await saveTasksSupabase(tasks);
  } catch (err) {
    console.warn('saveTasksWithFallback → localStorage', err);
    saveTasks(tasks);
  }
}

export async function deleteTaskWithFallback(id: string) {
  try {
    await deleteTaskSupabase(id);
  } catch (err) {
    console.warn('deleteTaskWithFallback → localStorage', err);
    saveTasks(loadTasks().filter(t => t.id !== id));
  }
}

/** Supabase → localStorage 폴백 */
export async function loadTasksWithFallback(): Promise<Task[]> {
  try {
    return await loadTasksSupabase();
  } catch (err) {
    console.warn('loadTasksWithFallback → localStorage', err);
    return loadTasks();
  }
}
