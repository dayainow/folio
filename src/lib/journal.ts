'use client';

import { requireAuthUser, isAuthenticated } from '@/lib/supabase';

export interface JournalEntry {
  id?: string;
  date: string;
  content: string;
  tags: string[];
  createdAt?: string;
  updatedAt: string;
}

const STORAGE_KEY = 'workspace_journals';

type JournalRow = {
  id: string;
  date: string;
  content: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

function rowToEntry(row: JournalRow): JournalEntry {
  return {
    id: row.id,
    date: row.date,
    content: row.content ?? '',
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function loadJournals(): Record<string, JournalEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveJournal(date: string, content: string, tags: string[]) {
  if (typeof window === 'undefined') return;
  const all = loadJournals();
  all[date] = { date, content, tags, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/** 저장된 일지들에서 중복 없는 태그 목록을 정렬해 반환 */
export function getAllTags(entries?: Record<string, { tags: string[] }>): string[] {
  const all = entries ?? loadJournals();
  return Array.from(new Set(Object.values(all).flatMap(e => e.tags ?? []))).sort((a, b) =>
    a.localeCompare(b, 'ko'),
  );
}

/** Supabase `journals` — 현재 user_id만 조회 */
export async function loadJournalsSupabase(): Promise<Record<string, JournalEntry>> {
  const { supabase, userId } = await requireAuthUser();
  const { data, error } = await supabase
    .from('journals')
    .select('id, date, content, tags, created_at, updated_at')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) throw error;

  const map: Record<string, JournalEntry> = {};
  for (const row of (data ?? []) as JournalRow[]) {
    map[row.date] = rowToEntry(row);
  }
  return map;
}

/** Supabase `journals` — user_id 포함 upsert */
export async function saveJournalSupabase(date: string, content: string, tags: string[]) {
  const { supabase, userId } = await requireAuthUser();
  const now = new Date().toISOString();
  const { error } = await supabase.from('journals').upsert(
    {
      user_id: userId,
      date,
      content,
      tags,
      updated_at: now,
    },
    { onConflict: 'user_id,date' },
  );

  if (error) throw error;
}

/** 로그인 시 Supabase, 아니면 localStorage */
export async function saveJournalWithFallback(date: string, content: string, tags: string[]) {
  if (!(await isAuthenticated())) {
    saveJournal(date, content, tags);
    return;
  }
  try {
    await saveJournalSupabase(date, content, tags);
  } catch {
    saveJournal(date, content, tags);
  }
}

/** 로그인 시 Supabase(본인 데이터), 아니면 localStorage */
export async function loadJournalsWithFallback(): Promise<Record<string, JournalEntry>> {
  const local = loadJournals();
  if (!(await isAuthenticated())) return local;
  try {
    return await loadJournalsSupabase();
  } catch {
    return local;
  }
}
