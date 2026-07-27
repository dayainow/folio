'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase';

export interface DocEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'workspace_docs';

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

async function requireUserId() {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Supabase 로그인이 필요합니다.');
  return { supabase, userId: data.user.id };
}

export function loadDocs(): DocEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaults();
  } catch {
    return getDefaults();
  }
}

function getDefaults(): DocEntry[] {
  return [
    {
      id: crypto.randomUUID(),
      title: '프로젝트 규칙',
      content: '# 프로젝트 규칙\n\n- 모든 이슈는 Jira에 생성한다\n- 코드 리뷰는 24시간 내에\n- 데일리 스탠드업 10시\n- PR은 최대 300줄',
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteDoc(id: string) {
  if (typeof window === 'undefined') return;
  const all = loadDocs().filter(d => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function loadCategories(): string[] {
  return [...DEFAULT_CATEGORIES];
}

/** Supabase `docs` 테이블에서 문서 목록을 불러온다 */
export async function loadDocsSupabase(): Promise<DocEntry[]> {
  const { supabase } = await requireUserId();
  const { data, error } = await supabase
    .from('docs')
    .select('id, title, content, category, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('loadDocsSupabase:', error.message);
    throw error;
  }

  return ((data ?? []) as DocRow[]).map(rowToDoc);
}

/** Supabase `docs` 테이블에 문서를 upsert한다 */
export async function saveDocSupabase(doc: DocEntry) {
  const { supabase, userId } = await requireUserId();
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

  if (error) {
    console.error('saveDocSupabase:', error.message);
    throw error;
  }
}

/** Supabase `docs` 테이블에서 문서를 삭제한다 */
export async function deleteDocSupabase(id: string) {
  const { supabase } = await requireUserId();
  const { error } = await supabase.from('docs').delete().eq('id', id);

  if (error) {
    console.error('deleteDocSupabase:', error.message);
    throw error;
  }
}

export async function saveDocWithFallback(doc: DocEntry) {
  try {
    await saveDocSupabase(doc);
  } catch (err) {
    console.warn('saveDocWithFallback → localStorage', err);
    saveDoc(doc);
  }
}

export async function deleteDocWithFallback(id: string) {
  try {
    await deleteDocSupabase(id);
  } catch (err) {
    console.warn('deleteDocWithFallback → localStorage', err);
    deleteDoc(id);
  }
}

/** Supabase → localStorage 폴백 */
export async function loadDocsWithFallback(): Promise<DocEntry[]> {
  try {
    return await loadDocsSupabase();
  } catch (err) {
    console.warn('loadDocsWithFallback → localStorage', err);
    return loadDocs();
  }
}
