'use client';

/**
 * Journal(일지) CRUD — 로컬 · Supabase · storage 폴백.
 */
import { requireAuthUser } from '@/lib/supabase';
import { loadWithFallback, saveWithFallback } from '@/lib/storage';
import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache';
import { cachedQuery, invalidateQueryCache } from '@/lib/query-cache';

/** P58 — 일지 발행 상태 */
export type JournalStatus = 'draft' | 'published' | 'archived';

export interface JournalEntry {
  id?: string;
  date: string;
  content: string;
  tags: string[];
  createdAt?: string;
  updatedAt: string;
  /** P58 — 기본 폴더 (트리 참조와 병행) */
  folder_id?: string | null;
  /** P58 — 상위 일지(중첩) */
  parent_id?: string | null;
  /** P58 — 프로젝트 연결 */
  projectId?: string | null;
  /** P58 — 중요도 1–5 */
  importance?: number;
  /** P58 — draft | published | archived */
  status?: JournalStatus;
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

/**
 * 로컬 즉시 저장(flush 포함). UI 수동 저장 버튼에서 원격 대기 없이 호출한다.
 */
export function saveJournal(date: string, content: string, tags: string[]) {
  const all = loadJournals();
  const prev = all[date];
  all[date] = {
    ...prev,
    date,
    content,
    tags,
    updatedAt: new Date().toISOString(),
    createdAt: prev?.createdAt ?? new Date().toISOString(),
  };
  setLocalJson(STORAGE_KEY, all);
  flushLocalJson(STORAGE_KEY);
}

/** P58 — 메타데이터(폴더·상태·프로젝트 등) 부분 갱신 */
export function patchJournalMeta(
  date: string,
  patch: Partial<
    Pick<JournalEntry, 'folder_id' | 'parent_id' | 'projectId' | 'importance' | 'status' | 'tags'>
  >,
): JournalEntry | null {
  const all = loadJournals();
  const prev = all[date];
  if (!prev) return null;
  const next: JournalEntry = {
    ...prev,
    ...patch,
    date,
    updatedAt: new Date().toISOString(),
  };
  all[date] = next;
  setLocalJson(STORAGE_KEY, all);
  flushLocalJson(STORAGE_KEY);
  return next;
}

export function bulkPatchJournalMeta(
  dates: string[],
  patch: Partial<
    Pick<JournalEntry, 'folder_id' | 'parent_id' | 'projectId' | 'importance' | 'status' | 'tags'>
  >,
): number {
  let n = 0;
  for (const d of dates) {
    if (patchJournalMeta(d, patch)) n += 1;
  }
  return n;
}

/** P58 — 일지 삭제 (로컬) */
export function deleteJournals(dates: string[]): number {
  const all = loadJournals();
  let n = 0;
  for (const d of dates) {
    if (all[d]) {
      delete all[d];
      n += 1;
    }
  }
  if (n) {
    setLocalJson(STORAGE_KEY, all);
    flushLocalJson(STORAGE_KEY);
  }
  return n;
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
  const prev = loadJournals()[date];
  const entry: JournalEntry = {
    ...prev,
    date,
    content,
    tags,
    updatedAt: new Date().toISOString(),
    createdAt: prev?.createdAt ?? new Date().toISOString(),
  };

  // 로컬 저장 시점에 최신 map과 merge — 수동/자동 저장 경쟁 시 stale 스냅샷 덮어쓰기 방지
  const result = await saveWithFallback(entry, 'journal', {
    localSave: () => {
      const next = { ...loadJournals(), [date]: entry };
      setLocalJson(STORAGE_KEY, next);
      flushLocalJson(STORAGE_KEY);
    },
    resolveRemoteData: () => ({ ...loadJournals(), [date]: entry }),
    cloudSave: async () => {
      await saveJournalSupabase(date, content, tags);
    },
  });

  if (result.usedFallback) {
    void import('@/lib/health-monitor').then(({ alertRemoteSaveFailure }) =>
      alertRemoteSaveFailure('journal', result.mode),
    );
  }

  return result;
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
