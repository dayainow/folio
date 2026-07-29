'use client';

import { requireAuthUser } from '@/lib/supabase';
import { loadWithFallback, saveWithFallback } from '@/lib/storage';
import { getLocalJson, setLocalJson } from '@/lib/local-cache';
import { cachedQuery, invalidateQueryCache } from '@/lib/query-cache';

export interface JournalEntry {
  id?: string;
  date: string;
  content: string;
  tags: string[];
  createdAt?: string;
  updatedAt: string;
}

const STORAGE_KEY = 'workspace_journals';
const SUPABASE_CACHE_KEY = 'supabase:journals';

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
  return getLocalJson<Record<string, JournalEntry>>(STORAGE_KEY, {});
}

export function saveJournal(date: string, content: string, tags: string[]) {
  const all = loadJournals();
  all[date] = { date, content, tags, updatedAt: new Date().toISOString() };
  setLocalJson(STORAGE_KEY, all);
}

/** 저장된 일지들에서 중복 없는 태그 목록을 정렬해 반환 */
export function getAllTags(entries?: Record<string, { tags: string[] }>): string[] {
  const all = entries ?? loadJournals();
  return Array.from(new Set(Object.values(all).flatMap(e => e.tags ?? []))).sort((a, b) =>
    a.localeCompare(b, 'ko'),
  );
}

/** Supabase `journals` — 현재 user_id만 조회 (5분 TTL) */
export async function loadJournalsSupabase(): Promise<Record<string, JournalEntry>> {
  return cachedQuery(SUPABASE_CACHE_KEY, async () => {
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
  });
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
  invalidateQueryCache(SUPABASE_CACHE_KEY);
}

/** 저장 모드(local/cloud/beacon)에 따라 분기 — `storage.ts` */
export async function saveJournalWithFallback(date: string, content: string, tags: string[]) {
  const entry = { date, content, tags, updatedAt: new Date().toISOString() };
  const next = { ...loadJournals(), [date]: entry };

  await saveWithFallback(next, 'journal', {
    localSave: () => {
      setLocalJson(STORAGE_KEY, next);
    },
    cloudSave: async () => {
      await saveJournalSupabase(date, content, tags);
    },
  });
}

/** 저장 모드에 따라 로드 */
export async function loadJournalsWithFallback(): Promise<Record<string, JournalEntry>> {
  return loadWithFallback({
    type: 'journal',
    localLoad: loadJournals,
    cloudLoad: loadJournalsSupabase,
    emptyBeacon: {},
  });
}
