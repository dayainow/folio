/**
 * P56 — 문서/일지/태스크 북마크 + 폴더/태그
 */
'use client'

import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache'

export type BookmarkKind = 'journal' | 'doc' | 'task'

export type Bookmark = {
  id: string
  kind: BookmarkKind
  /** journal: YYYY-MM-DD, doc/task: uuid */
  targetId: string
  title: string
  folderId: string | null
  tags: string[]
  createdAt: string
}

export type BookmarkFolder = {
  id: string
  name: string
}

type Store = {
  folders: BookmarkFolder[]
  items: Bookmark[]
}

const STORAGE_KEY = 'folio_bookmarks_v1'

function empty(): Store {
  return {
    folders: [{ id: 'default', name: '기본' }],
    items: [],
  }
}

export function loadBookmarks(): Store {
  const raw = getLocalJson<Store | null>(STORAGE_KEY, null)
  if (!raw || !Array.isArray(raw.items)) return empty()
  return {
    folders: Array.isArray(raw.folders) && raw.folders.length ? raw.folders : empty().folders,
    items: raw.items,
  }
}

function save(store: Store) {
  setLocalJson(STORAGE_KEY, store)
  flushLocalJson(STORAGE_KEY)
}

export function addBookmark(input: {
  kind: BookmarkKind
  targetId: string
  title: string
  folderId?: string | null
  tags?: string[]
}): Bookmark {
  const store = loadBookmarks()
  const existing = store.items.find(
    (b) => b.kind === input.kind && b.targetId === input.targetId,
  )
  if (existing) {
    const updated = {
      ...existing,
      title: input.title,
      folderId: input.folderId ?? existing.folderId,
      tags: input.tags ?? existing.tags,
    }
    store.items = store.items.map((b) => (b.id === existing.id ? updated : b))
    save(store)
    return updated
  }
  const item: Bookmark = {
    id: crypto.randomUUID(),
    kind: input.kind,
    targetId: input.targetId,
    title: input.title,
    folderId: input.folderId ?? 'default',
    tags: input.tags ?? [],
    createdAt: new Date().toISOString(),
  }
  store.items = [item, ...store.items]
  save(store)
  return item
}

export function removeBookmark(id: string): void {
  const store = loadBookmarks()
  store.items = store.items.filter((b) => b.id !== id)
  save(store)
}

export function removeBookmarkByTarget(kind: BookmarkKind, targetId: string): void {
  const store = loadBookmarks()
  store.items = store.items.filter((b) => !(b.kind === kind && b.targetId === targetId))
  save(store)
}

export function isBookmarked(kind: BookmarkKind, targetId: string): boolean {
  return loadBookmarks().items.some((b) => b.kind === kind && b.targetId === targetId)
}

export function toggleBookmark(input: {
  kind: BookmarkKind
  targetId: string
  title: string
  folderId?: string | null
  tags?: string[]
}): boolean {
  if (isBookmarked(input.kind, input.targetId)) {
    removeBookmarkByTarget(input.kind, input.targetId)
    return false
  }
  addBookmark(input)
  return true
}

export function createFolder(name: string): BookmarkFolder {
  const store = loadBookmarks()
  const folder: BookmarkFolder = { id: crypto.randomUUID(), name: name.trim() || '폴더' }
  store.folders = [...store.folders, folder]
  save(store)
  return folder
}

export function renameFolder(id: string, name: string): void {
  const store = loadBookmarks()
  store.folders = store.folders.map((f) => (f.id === id ? { ...f, name } : f))
  save(store)
}

export function deleteFolder(id: string): void {
  if (id === 'default') return
  const store = loadBookmarks()
  store.folders = store.folders.filter((f) => f.id !== id)
  store.items = store.items.map((b) =>
    b.folderId === id ? { ...b, folderId: 'default' } : b,
  )
  save(store)
}

export function setBookmarkFolder(bookmarkId: string, folderId: string | null): void {
  const store = loadBookmarks()
  store.items = store.items.map((b) =>
    b.id === bookmarkId ? { ...b, folderId } : b,
  )
  save(store)
}

export function setBookmarkTags(bookmarkId: string, tags: string[]): void {
  const store = loadBookmarks()
  store.items = store.items.map((b) => (b.id === bookmarkId ? { ...b, tags } : b))
  save(store)
}

export function listByFolder(folderId: string | null): Bookmark[] {
  return loadBookmarks().items.filter((b) => (b.folderId ?? 'default') === (folderId ?? 'default'))
}
