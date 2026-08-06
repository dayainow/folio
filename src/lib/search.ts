'use client';

/**
 * Journal / Docs / Board 통합 검색.
 * P52: Lunr 고급 검색은 `@/lib/search-engine` · `advancedSearchAll`.
 */
import { loadJournalsWithFallback, type JournalEntry } from '@/lib/journal';
import { loadDocsWithFallback, type DocEntry } from '@/lib/docs';
import { loadTasksWithFallback, type Task } from '@/lib/board';
import {
  runAdvancedSearch,
  toSearchAllResult,
  type AdvancedSearchFilters,
  type AdvancedSearchResult,
} from '@/lib/search-engine';

export type SearchSource = 'journal' | 'docs' | 'board';
export type MatchField = 'title' | 'content' | 'tag';

export interface JournalSearchHit {
  id: string;
  date: string;
  title: string;
  preview: string;
  tags: string[];
  updatedAt: string;
  score: number;
  matched: MatchField;
}

export interface DocSearchHit {
  id: string;
  title: string;
  preview: string;
  category: string;
  updatedAt: string;
  score: number;
  matched: MatchField;
}

export interface TaskSearchHit {
  id: string;
  title: string;
  preview: string;
  status: Task['status'];
  tags: string[];
  updatedAt: string;
  score: number;
  matched: MatchField;
}

export interface SearchAllResult {
  journals: JournalSearchHit[];
  docs: DocSearchHit[];
  tasks: TaskSearchHit[];
}

function firstLine(content: string): string {
  const line = content
    .split(/\r?\n/)
    .map(l => l.replace(/^#+\s*/, '').trim())
    .find(Boolean);
  return line || '빈 일지';
}

function snippetAround(text: string, query: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  const q = query.toLowerCase();
  const lower = flat.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) {
    return flat.length > max ? `${flat.slice(0, max)}…` : flat;
  }
  const start = Math.max(0, idx - 24);
  const end = Math.min(flat.length, idx + q.length + 72);
  const slice = flat.slice(start, end);
  return `${start > 0 ? '…' : ''}${slice}${end < flat.length ? '…' : ''}`;
}

/** 제목 매칭 > 태그 > 내용. 부분 일치. */
export function scoreMatch(
  query: string,
  title: string,
  content: string,
  tags: string[] = [],
): { score: number; matched: MatchField } | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const t = title.toLowerCase();
  if (t.includes(q)) {
    let score = 100;
    if (t === q) score += 40;
    else if (t.startsWith(q)) score += 20;
    score += Math.min(q.length, 30);
    return { score, matched: 'title' };
  }

  if (tags.some(tag => tag.toLowerCase().includes(q))) {
    return { score: 70 + Math.min(q.length, 20), matched: 'tag' };
  }

  if (content.toLowerCase().includes(q)) {
    return { score: 40 + Math.min(q.length, 20), matched: 'content' };
  }

  return null;
}

function byScoreDesc<T extends { score: number }>(a: T, b: T) {
  return b.score - a.score;
}

function searchJournals(entries: Record<string, JournalEntry>, query: string): JournalSearchHit[] {
  const hits: JournalSearchHit[] = [];
  for (const entry of Object.values(entries)) {
    const title = `${entry.date} · ${firstLine(entry.content)}`;
    const scored = scoreMatch(query, entry.date, entry.content, entry.tags);
    const scoredTitle = scoreMatch(query, title, entry.content, entry.tags);
    const best = [scored, scoredTitle]
      .filter(Boolean)
      .sort((a, b) => (b!.score - a!.score))[0];
    if (!best) continue;
    hits.push({
      id: entry.date,
      date: entry.date,
      title,
      preview: snippetAround(entry.content, query),
      tags: entry.tags,
      updatedAt: entry.updatedAt,
      score: best.score,
      matched: best.matched,
    });
  }
  return hits.sort(byScoreDesc);
}

function searchDocs(docs: DocEntry[], query: string): DocSearchHit[] {
  const hits: DocSearchHit[] = [];
  for (const doc of docs) {
    const scored = scoreMatch(query, doc.title, `${doc.content}\n${doc.category}`);
    if (!scored) continue;
    hits.push({
      id: doc.id,
      title: doc.title,
      preview: snippetAround(doc.content, query) || doc.category,
      category: doc.category,
      updatedAt: doc.updatedAt,
      score: scored.score,
      matched: scored.matched,
    });
  }
  return hits.sort(byScoreDesc);
}

function searchTasks(tasks: Task[], query: string): TaskSearchHit[] {
  const hits: TaskSearchHit[] = [];
  for (const task of tasks) {
    const scored = scoreMatch(query, task.title, task.description, task.tags);
    if (!scored) continue;
    hits.push({
      id: task.id,
      title: task.title,
      preview: snippetAround(task.description, query) || task.status,
      status: task.status,
      tags: task.tags,
      updatedAt: task.updatedAt,
      score: scored.score,
      matched: scored.matched,
    });
  }
  return hits.sort(byScoreDesc);
}

/**
 * Journal / Docs / Board 통합 검색.
 * Supabase 우선(`*WithFallback`), 실패 시 localStorage.
 */
export async function searchAll(query: string): Promise<SearchAllResult> {
  const q = query.trim();
  if (!q) {
    return { journals: [], docs: [], tasks: [] };
  }

  const [journals, docs, tasks] = await Promise.all([
    loadJournalsWithFallback(),
    loadDocsWithFallback(),
    loadTasksWithFallback(),
  ]);

  return {
    journals: searchJournals(journals, q),
    docs: searchDocs(docs, q),
    tasks: searchTasks(tasks, q),
  };
}

/** P52 — Lunr 고급 검색 + 필터 · P67 의미 검색 병합 */
export async function advancedSearchAll(
  query: string,
  filters: AdvancedSearchFilters = {},
): Promise<AdvancedSearchResult> {
  const [journals, docs, tasks] = await Promise.all([
    loadJournalsWithFallback(),
    loadDocsWithFallback(),
    loadTasksWithFallback(),
  ]);
  const base = runAdvancedSearch(query, journals, docs, tasks, filters);
  if (!filters.semantic || !query.trim()) return base;

  const { semanticSearchLocal } = await import('@/lib/ai-semantic');
  const corpus = [
    ...Object.entries(journals).map(([date, e]) => ({
      id: `journal:${date}`,
      source: 'journal' as const,
      title: date,
      text: e.content ?? '',
      updatedAt: e.updatedAt,
      tags: e.tags,
    })),
    ...docs.map((d) => ({
      id: `docs:${d.id}`,
      source: 'doc' as const,
      title: d.title,
      text: d.content ?? '',
      updatedAt: d.updatedAt,
      tags: d.category ? [d.category] : [],
    })),
    ...tasks.map((t) => ({
      id: `board:${t.id}`,
      source: 'task' as const,
      title: t.title,
      text: t.description ?? '',
      updatedAt: t.updatedAt,
      tags: t.tags,
    })),
  ];
  const sem = semanticSearchLocal(query, corpus, 24);
  const byId = new Map(base.unified.map((h) => [h.id, h]));
  for (const hit of sem) {
    const source =
      hit.source === 'journal' ? 'journal' : hit.source === 'doc' ? 'docs' : 'board';
    const id = hit.id.includes(':') ? hit.id : `${source}:${hit.id}`;
    const existing = byId.get(id) ?? byId.get(hit.id.replace(/^(journal|docs|board|j|d|t):/, ''));
    const score = Math.max(existing?.score ?? 0, hit.score * 12);
    byId.set(existing?.id ?? id, {
      source,
      id: existing?.id ?? id.replace(/^(journal|docs|board):/, ''),
      title: hit.title,
      preview: hit.preview,
      score,
      matched: 'content',
      updatedAt: hit.updatedAt ?? existing?.updatedAt ?? '',
      tags: hit.tags,
    });
  }
  const unified = [...byId.values()].sort((a, b) => b.score - a.score);
  return {
    ...base,
    unified,
    total: unified.length,
    parsedQuery: `${base.parsedQuery || query} · semantic`,
  };
}

/** 간단 검색을 Lunr 경로로 (선택) */
export async function searchAllAdvanced(query: string): Promise<SearchAllResult> {
  const adv = await advancedSearchAll(query, { sort: 'relevance' });
  return toSearchAllResult(adv);
}
