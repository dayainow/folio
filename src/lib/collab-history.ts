/**
 * P43 — 협업 변경 이력 · 간단 diff · 로컬 스냅샷
 */
'use client'

export type CollabHistoryEntry = {
  id: string
  roomId: string
  text: string
  label: string
  createdAt: string
  actorName?: string
}

export type TextDiff = {
  before: string
  after: string
  /** 줄 단위 diff 표시용 */
  lines: Array<{ type: 'same' | 'add' | 'del'; text: string }>
}

const KEY = 'folio_collab_history_v1'
const MAX_PER_ROOM = 40

function readAll(): CollabHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CollabHistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(items: CollabHistoryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent('folio-collab-history'))
  } catch {
    /* quota */
  }
}

export function listCollabHistory(roomId: string): CollabHistoryEntry[] {
  return readAll()
    .filter((e) => e.roomId === roomId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function pushCollabSnapshot(input: {
  roomId: string
  text: string
  label?: string
  actorName?: string
}): CollabHistoryEntry | null {
  const prev = listCollabHistory(input.roomId)[0]
  if (prev && prev.text === input.text) return null

  const entry: CollabHistoryEntry = {
    id: crypto.randomUUID(),
    roomId: input.roomId,
    text: input.text,
    label: input.label ?? '스냅샷',
    createdAt: new Date().toISOString(),
    actorName: input.actorName,
  }
  const others = readAll().filter((e) => e.roomId !== input.roomId)
  const room = [entry, ...listCollabHistory(input.roomId)].slice(0, MAX_PER_ROOM)
  writeAll([...room, ...others])
  return entry
}

export function getCollabSnapshot(id: string): CollabHistoryEntry | null {
  return readAll().find((e) => e.id === id) ?? null
}

export function subscribeCollabHistory(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const h = () => cb()
  window.addEventListener('folio-collab-history', h)
  window.addEventListener('storage', h)
  return () => {
    window.removeEventListener('folio-collab-history', h)
    window.removeEventListener('storage', h)
  }
}

/** Myers-lite 줄 단위 diff */
export function diffLines(before: string, after: string): TextDiff {
  const a = before.split('\n')
  const b = after.split('\n')
  const lines: TextDiff['lines'] = []
  const max = Math.max(a.length, b.length)
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push({ type: 'same', text: a[i]! })
      i++
      j++
      continue
    }
    if (j < b.length && (i >= a.length || !a.slice(i).includes(b[j]!))) {
      lines.push({ type: 'add', text: b[j]! })
      j++
      continue
    }
    if (i < a.length) {
      lines.push({ type: 'del', text: a[i]! })
      i++
      continue
    }
    // safety
    if (j < b.length) {
      lines.push({ type: 'add', text: b[j]! })
      j++
    }
    if (i + j > max * 3) break
  }
  return { before, after, lines }
}

/** 공통 prefix/suffix 기반 문자 구간 — Yjs setText 최적화용 */
export function findReplaceRange(
  cur: string,
  next: string,
): { start: number; deleteLen: number; insert: string } | null {
  if (cur === next) return null
  let start = 0
  const minLen = Math.min(cur.length, next.length)
  while (start < minLen && cur.charCodeAt(start) === next.charCodeAt(start)) start++
  let endOld = cur.length
  let endNew = next.length
  while (
    endOld > start &&
    endNew > start &&
    cur.charCodeAt(endOld - 1) === next.charCodeAt(endNew - 1)
  ) {
    endOld--
    endNew--
  }
  return {
    start,
    deleteLen: endOld - start,
    insert: next.slice(start, endNew),
  }
}
