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
