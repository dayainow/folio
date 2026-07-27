'use client';

import { requireAuthUser, isAuthenticated } from '@/lib/supabase';

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

/** Supabase `boards` — 현재 user_id만 조회 */
export async function loadTasksSupabase(): Promise<Task[]> {
  const { supabase, userId } = await requireAuthUser();
  const { data, error } = await supabase
    .from('boards')
    .select('id, title, description, status, priority, tags, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as BoardRow[]).map(rowToTask);
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
}

export async function saveTaskWithFallback(task: Task) {
  if (!(await isAuthenticated())) {
    const all = loadTasks();
    const idx = all.findIndex(t => t.id === task.id);
    if (idx >= 0) all[idx] = task;
    else all.push(task);
    saveTasks(all);
    return;
  }
  try {
    await saveTaskSupabase(task);
  } catch {
    const all = loadTasks();
    const idx = all.findIndex(t => t.id === task.id);
    if (idx >= 0) all[idx] = task;
    else all.push(task);
    saveTasks(all);
  }
}

export async function saveTasksWithFallback(tasks: Task[]) {
  if (!(await isAuthenticated())) {
    saveTasks(tasks);
    return;
  }
  try {
    await saveTasksSupabase(tasks);
  } catch {
    saveTasks(tasks);
  }
}

export async function deleteTaskWithFallback(id: string) {
  if (!(await isAuthenticated())) {
    saveTasks(loadTasks().filter(t => t.id !== id));
    return;
  }
  try {
    await deleteTaskSupabase(id);
  } catch {
    saveTasks(loadTasks().filter(t => t.id !== id));
  }
}

/** 로그인 시 Supabase(본인), 아니면 localStorage */
export async function loadTasksWithFallback(): Promise<Task[]> {
  if (!(await isAuthenticated())) return loadTasks();
  try {
    return await loadTasksSupabase();
  } catch {
    return loadTasks();
  }
}
