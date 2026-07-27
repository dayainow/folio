'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase';

export interface JournalEntry {
  date: string;
  content: string;
  tags: string[];
  updatedAt: string;
}

const STORAGE_KEY = 'workspace_journals';

type JournalRow = {
  date: string;
  content: string;
  tags: string[] | null;
  updated_at: string;
};

function rowToEntry(row: JournalRow): JournalEntry {
  return {
    date: row.date,
    content: row.content ?? '',
    tags: row.tags ?? [],
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

/** Supabase `journals` 테이블에서 일지 목록을 불러온다 */
export async function loadJournalsSupabase(): Promise<Record<string, JournalEntry>> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from('journals')
    .select('date, content, tags, updated_at')
    .order('date', { ascending: false });

  if (error) {
    console.error('loadJournalsSupabase:', error.message);
    throw error;
  }

  const map: Record<string, JournalEntry> = {};
  for (const row of (data ?? []) as JournalRow[]) {
    map[row.date] = rowToEntry(row);
  }
  return map;
}

/** Supabase `journals` 테이블에 일지를 upsert한다 */
export async function saveJournalSupabase(date: string, content: string, tags: string[]) {
  const supabase = createBrowserSupabaseClient();
  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from('journals').upsert(
    {
      date,
      content,
      tags,
      updated_at: updatedAt,
    },
    { onConflict: 'date' },
  );

  if (error) {
    console.error('saveJournalSupabase:', error.message);
    throw error;
  }
}
