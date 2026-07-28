'use client';

import { requireAuthUser, isAuthenticated } from '@/lib/supabase';

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

export function loadCategories(docs?: DocEntry[]): string[] {
  const source = docs ?? (typeof window !== 'undefined' ? loadDocs() : []);
  const fromDocs = source.map(d => d.category).filter(Boolean);
  return Array.from(new Set([...DEFAULT_CATEGORIES, 'Obsidian Import', ...fromDocs]));
}

/** Supabase `docs` — 현재 user_id만 조회 */
export async function loadDocsSupabase(): Promise<DocEntry[]> {
  const { supabase, userId } = await requireAuthUser();
  const { data, error } = await supabase
    .from('docs')
    .select('id, title, content, category, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as DocRow[]).map(rowToDoc);
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
}

/** Supabase `docs` — 본인 레코드만 삭제 */
export async function deleteDocSupabase(id: string) {
  const { supabase, userId } = await requireAuthUser();
  const { error } = await supabase.from('docs').delete().eq('id', id).eq('user_id', userId);

  if (error) throw error;
}

export async function saveDocWithFallback(doc: DocEntry) {
  if (!(await isAuthenticated())) {
    saveDoc(doc);
    return;
  }
  try {
    await saveDocSupabase(doc);
  } catch {
    saveDoc(doc);
  }
}

export async function deleteDocWithFallback(id: string) {
  if (!(await isAuthenticated())) {
    deleteDoc(id);
    return;
  }
  try {
    await deleteDocSupabase(id);
  } catch {
    deleteDoc(id);
  }
}

/** 로그인 시 Supabase(본인), 아니면 localStorage */
export async function loadDocsWithFallback(): Promise<DocEntry[]> {
  if (!(await isAuthenticated())) return loadDocs();
  try {
    return await loadDocsSupabase();
  } catch {
    return loadDocs();
  }
}
