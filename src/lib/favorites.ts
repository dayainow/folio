'use client';

/**
 * Board 즐겨찾기 ID 목록 (localStorage).
 */
const STORAGE_KEY = 'workspace_favorites';

export function loadFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveFavorites(ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function toggleFavorite(id: string, current?: string[]): string[] {
  const list = current ?? loadFavorites();
  const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id];
  saveFavorites(next);
  return next;
}
