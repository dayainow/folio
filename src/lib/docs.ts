'use client';

/**
 * Docs(문서) CRUD — 로컬 · Supabase · storage 폴백.
 */
import { requireAuthUser } from '@/lib/supabase';
import { loadWithFallback, saveWithFallback } from '@/lib/storage';
import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache';
import { cachedQuery, invalidateQueryCache } from '@/lib/query-cache';

export interface DocEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'workspace_docs';
const SUPABASE_CACHE_KEY = 'supabase:docs';

const DEFAULT_CATEGORIES = [
  'Dev Guide',
  'API',
  'Policy',
  'Design',
  'Deploy',
  'Meeting',
];

type DocRow = {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
};

function rowToDoc(row: DocRow): DocEntry {
  return {
    id: row.id,
    title: row.title,
    content: row.content ?? '',
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function loadDocs(): DocEntry[] {
  if (typeof window === 'undefined') return [];
  const stored = getLocalJson<DocEntry[] | null>(STORAGE_KEY, null);
  if (stored !== null && Array.isArray(stored)) return stored;
  const defaults = getDefaults();
  setLocalJson(STORAGE_KEY, defaults);
  return defaults;
}

function getDefaults(): DocEntry[] {
  return [
    {
      id: crypto.randomUUID(),
      title: '프로젝트 규칙',
      content: '# 프로젝트 규칙\n\n- 모든 이슈는 Jira에 생성한다\n- 코드 리뷰는 24시간 내에\n- 데일리 스탠드업 10시\n- PR은 최대 300줄\n- API는 [[API 명세]] 를 따른다',
      category: 'Policy',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: 'API 명세',
      content: '# API 명세\n\nBase URL: `https://api.example.com/v1`\n\n## 인증\n`Authorization: Bearer <token>`\n\n## 엔드포인트\n- GET /users\n- GET /projects/:id\n- POST /tasks',
      category: 'API',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

export function saveDoc(doc: DocEntry) {
  if (typeof window === 'undefined') return;
  const all = loadDocs();
  const idx = all.findIndex(d => d.id === doc.id);
  if (idx >= 0) {
    all[idx] = { ...doc, updatedAt: new Date().toISOString() };
  } else {
    all.push({ ...doc, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  setLocalJson(STORAGE_KEY, all);
}

export function deleteDoc(id: string) {
  if (typeof window === 'undefined') return;
  const all = loadDocs().filter(d => d.id !== id);
  setLocalJson(STORAGE_KEY, all);
}

export function loadCategories(docs?: DocEntry[]): string[] {
  const source = docs ?? (typeof window !== 'undefined' ? loadDocs() : []);
  const fromDocs = source.map(d => d.category).filter(Boolean);
  return Array.from(new Set([...DEFAULT_CATEGORIES, 'Obsidian Import', ...fromDocs]));
}

/** Supabase `docs` — 현재 user_id만 조회 (5분 TTL) */
export async function loadDocsSupabase(): Promise<DocEntry[]> {
  return cachedQuery(SUPABASE_CACHE_KEY, async () => {
    const { supabase, userId } = await requireAuthUser();
    const { data, error } = await supabase
      .from('docs')
      .select('id, title, content, category, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return ((data ?? []) as DocRow[]).map(rowToDoc);
  });
}

/** Supabase `docs` — user_id 포함 upsert */
export async function saveDocSupabase(doc: DocEntry) {
  const { supabase, userId } = await requireAuthUser();
  const now = new Date().toISOString();
  const { error } = await supabase.from('docs').upsert(
    {
      id: doc.id,
      user_id: userId,
      title: doc.title,
      content: doc.content,
      category: doc.category,
      created_at: doc.createdAt || now,
      updated_at: now,
    },
    { onConflict: 'id' },
  );

  if (error) throw error;
  invalidateQueryCache(SUPABASE_CACHE_KEY);
}

/** Supabase `docs` — 본인 레코드만 삭제 */
export async function deleteDocSupabase(id: string) {
  const { supabase, userId } = await requireAuthUser();
  const { error } = await supabase.from('docs').delete().eq('id', id).eq('user_id', userId);

  if (error) throw error;
  invalidateQueryCache(SUPABASE_CACHE_KEY);
}

export async function saveDocWithFallback(doc: DocEntry) {
  const now = new Date().toISOString();
  const updated: DocEntry = {
    ...doc,
    createdAt: doc.createdAt || now,
    updatedAt: now,
  };
  const all = loadDocs();
  const idx = all.findIndex(d => d.id === updated.id);
  const next = [...all];
  if (idx >= 0) next[idx] = updated;
  else next.push(updated);

  const result = await saveWithFallback(next, 'docs', {
    localSave: () => {
      setLocalJson(STORAGE_KEY, next);
      flushLocalJson(STORAGE_KEY);
    },
    cloudSave: async () => {
      await saveDocSupabase(updated);
    },
  });

  if (result.usedFallback) {
    void import('@/lib/health-monitor').then(({ alertRemoteSaveFailure }) =>
      alertRemoteSaveFailure('docs', result.mode),
    );
  }

  return result;
}

export async function deleteDocWithFallback(id: string) {
  const next = loadDocs().filter(d => d.id !== id);
  const result = await saveWithFallback(next, 'docs', {
    localSave: () => {
      setLocalJson(STORAGE_KEY, next);
      flushLocalJson(STORAGE_KEY);
    },
    cloudSave: async () => {
      await deleteDocSupabase(id);
    },
  });

  if (result.usedFallback) {
    void import('@/lib/health-monitor').then(({ alertRemoteSaveFailure }) =>
      alertRemoteSaveFailure('docs', result.mode),
    );
  }

  return result;
}

/** 저장 모드에 따라 로드 */
export async function loadDocsWithFallback(): Promise<DocEntry[]> {
  return loadWithFallback({
    type: 'docs',
    localLoad: loadDocs,
    cloudLoad: loadDocsSupabase,
    emptyBeacon: [],
  });
}
