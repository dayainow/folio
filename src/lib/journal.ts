'use client';

export interface JournalEntry {
  date: string;
  content: string;
  tags: string[];
  updatedAt: string;
}

const STORAGE_KEY = 'workspace_journals';

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
