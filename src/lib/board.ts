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
}

const STORAGE_KEY = 'workspace_tasks';

const DEFAULT_COLUMNS: { key: Task['status']; label: string; color: string }[] = [
  { key: 'backlog', label: 'Backlog', color: 'bg-gray-100' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-blue-50' },
  { key: 'review', label: 'Review', color: 'bg-yellow-50' },
  { key: 'done', label: 'Done', color: 'bg-green-50' },
];

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: Task['status'];
  priority: Task['priority'];
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

function rowToTask(row: TaskRow): Task {
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

function taskToRow(task: Task) {
  return {
    id: task.id,
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

/** Supabase `tasks` 테이블에서 태스크 목록을 불러온다 */
export async function loadTasksSupabase(): Promise<Task[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, description, status, priority, tags, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('loadTasksSupabase:', error.message);
    throw error;
  }

  return ((data ?? []) as TaskRow[]).map(rowToTask);
}

/** Supabase `tasks` 테이블에 태스크 목록을 upsert한다 */
export async function saveTasksSupabase(tasks: Task[]) {
  const supabase = createBrowserSupabaseClient();
  const now = new Date().toISOString();
  const rows = tasks.map(t =>
    taskToRow({
      ...t,
      updatedAt: t.updatedAt || now,
      createdAt: t.createdAt || now,
    }),
  );

  const { error } = await supabase.from('tasks').upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('saveTasksSupabase:', error.message);
    throw error;
  }
}

/** Supabase `tasks` 테이블에 단일 태스크를 upsert한다 */
export async function saveTaskSupabase(task: Task) {
  return saveTasksSupabase([task]);
}

/** Supabase `tasks` 테이블에서 태스크를 삭제한다 */
export async function deleteTaskSupabase(id: string) {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from('tasks').delete().eq('id', id);

  if (error) {
    console.error('deleteTaskSupabase:', error.message);
    throw error;
  }
}
