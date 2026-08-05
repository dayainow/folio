/**
 * P59 — 문서 버전 관리 (스냅샷 · diff · 복원 · 체크아웃 · 자동 저장)
 */
'use client'

import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache'
import { diffLines, type TextDiff } from '@/lib/collab-history'
import type { DocEntry } from '@/lib/docs'

export type DocVersionKind = 'auto' | 'manual' | 'important' | 'checkpoint'

export type DocVersion = {
  id: string
  docId: string
  /** 표시용 v1.0, v1.1 … */
  label: string
  major: number
  minor: number
  title: string
  content: string
  category: string
  kind: DocVersionKind
  /** 사용자 메모/태그 */
  note?: string
  createdAt: string
  changeSummary?: string
}

type Store = Record<string, DocVersion[]>

const STORAGE_KEY = 'folio_doc_versions_v1'
const MAX_PER_DOC = 80
const AUTO_INTERVAL_MS = 5 * 60 * 1000

export type WordDiffPart = {
  type: 'same' | 'add' | 'del'
  text: string
}

function loadStore(): Store {
  const raw = getLocalJson<Store | null>(STORAGE_KEY, null)
  if (!raw || typeof raw !== 'object') return {}
  return raw
}

function saveStore(store: Store) {
  setLocalJson(STORAGE_KEY, store)
  flushLocalJson(STORAGE_KEY)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('folio-doc-versions'))
  }
}

export function listDocVersions(docId: string): DocVersion[] {
  return [...(loadStore()[docId] ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getDocVersion(docId: string, versionId: string): DocVersion | null {
  return listDocVersions(docId).find((v) => v.id === versionId) ?? null
}

export function subscribeDocVersions(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const h = () => cb()
  window.addEventListener('folio-doc-versions', h)
  window.addEventListener('storage', h)
  return () => {
    window.removeEventListener('folio-doc-versions', h)
    window.removeEventListener('storage', h)
  }
}

function nextNumbers(docId: string, bump: 'minor' | 'major'): { major: number; minor: number; label: string } {
  const versions = listDocVersions(docId)
  if (versions.length === 0) return { major: 1, minor: 0, label: 'v1.0' }
  const latest = [...versions].sort((a, b) =>
    a.major !== b.major ? b.major - a.major : b.minor - a.minor,
  )[0]!
  if (bump === 'major') {
    const major = latest.major + 1
    return { major, minor: 0, label: `v${major}.0` }
  }
  const major = latest.major
  const minor = latest.minor + 1
  return { major, minor, label: `v${major}.${minor}` }
}

function summarizeChange(prev: DocVersion | undefined, next: Pick<DocEntry, 'title' | 'content' | 'category'>): string {
  if (!prev) return '최초 버전'
  const parts: string[] = []
  if (prev.title !== next.title) parts.push('제목 변경')
  if (prev.category !== next.category) parts.push('카테고리 변경')
  if (prev.content !== next.content) {
    const a = prev.content.split('\n').length
    const b = next.content.split('\n').length
    const delta = b - a
    parts.push(delta === 0 ? '내용 수정' : delta > 0 ? `+${delta}줄` : `${delta}줄`)
  }
  return parts.join(' · ') || '변경 없음'
}

/** 중요한 변경: 제목 변경 또는 본문 20%+ / 200자+ 변화 */
export function isImportantDocChange(
  before: Pick<DocEntry, 'title' | 'content' | 'category'> | null | undefined,
  after: Pick<DocEntry, 'title' | 'content' | 'category'>,
): boolean {
  if (!before) return true
  if (before.title !== after.title) return true
  if (before.category !== after.category) return false
  const a = before.content
  const b = after.content
  if (a === b) return false
  const diffLen = Math.abs(a.length - b.length)
  if (diffLen >= 200) return true
  const base = Math.max(a.length, 1)
  return diffLen / base >= 0.2
}

export function createDocSnapshot(input: {
  doc: DocEntry
  kind?: DocVersionKind
  note?: string
  bump?: 'minor' | 'major'
  /** 동일 내용이면 스킵 (기본 true) */
  skipIfUnchanged?: boolean
}): DocVersion | null {
  const kind = input.kind ?? 'auto'
  const skip = input.skipIfUnchanged !== false
  const store = loadStore()
  const list = store[input.doc.id] ?? []
  const latest = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (
    skip &&
    latest &&
    latest.content === input.doc.content &&
    latest.title === input.doc.title &&
    latest.category === input.doc.category
  ) {
    return null
  }

  const bump =
    input.bump ??
    (kind === 'important' || kind === 'manual' || kind === 'checkpoint' ? 'minor' : 'minor')
  const nums = nextNumbers(input.doc.id, bump)
  const entry: DocVersion = {
    id: crypto.randomUUID(),
    docId: input.doc.id,
    label: nums.label,
    major: nums.major,
    minor: nums.minor,
    title: input.doc.title,
    content: input.doc.content,
    category: input.doc.category,
    kind,
    note: input.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
    changeSummary: summarizeChange(latest, input.doc),
  }
  store[input.doc.id] = [entry, ...list].slice(0, MAX_PER_DOC)
  saveStore(store)
  return entry
}

/** 저장 시 정책: 중요 변경이면 important, 아니면 auto (내용 동일 시 null) */
export function snapshotOnSave(doc: DocEntry, previous?: DocEntry | null): DocVersion | null {
  if (listDocVersions(doc.id).length === 0) {
    return createDocSnapshot({ doc, kind: 'checkpoint', note: '초기 버전', skipIfUnchanged: false })
  }
  const important = isImportantDocChange(previous ?? null, doc)
  return createDocSnapshot({
    doc,
    kind: important ? 'important' : 'auto',
    skipIfUnchanged: true,
  })
}

export function createManualDocVersion(doc: DocEntry, note?: string): DocVersion | null {
  return createDocSnapshot({
    doc,
    kind: 'manual',
    note,
    bump: 'minor',
    skipIfUnchanged: false,
  })
}

export function restoreFromVersion(version: DocVersion): Pick<DocEntry, 'title' | 'content' | 'category'> {
  return {
    title: version.title,
    content: version.content,
    category: version.category,
  }
}

/** 버전을 새 문서로 체크아웃 (이름 변경) */
export function checkoutVersionAsDoc(
  version: DocVersion,
  newTitle: string,
): Omit<DocEntry, 'id'> & { id?: string } {
  return {
    title: newTitle.trim() || `${version.title} (${version.label})`,
    content: version.content,
    category: version.category,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function diffDocContents(before: string, after: string): TextDiff {
  return diffLines(before, after)
}

/** 단어 단위 diff (공백 보존 토큰) */
export function diffWords(before: string, after: string): WordDiffPart[] {
  const tokenize = (s: string) => s.match(/\s+|[^\s]+/g) ?? []
  const a = tokenize(before)
  const b = tokenize(after)
  const out: WordDiffPart[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ type: 'same', text: a[i]! })
      i++
      j++
      continue
    }
    if (j < b.length && (i >= a.length || !a.slice(i).includes(b[j]!))) {
      out.push({ type: 'add', text: b[j]! })
      j++
      continue
    }
    if (i < a.length) {
      out.push({ type: 'del', text: a[i]! })
      i++
      continue
    }
    if (j < b.length) {
      out.push({ type: 'add', text: b[j]! })
      j++
    }
    if (out.length > (a.length + b.length) * 3) break
  }
  return out
}

export function deleteDocVersions(docId: string): void {
  const store = loadStore()
  delete store[docId]
  saveStore(store)
}

const autoTimers = new Map<string, ReturnType<typeof setInterval>>()

/** 5분마다 현재 초안을 자동 스냅샷 (동일 내용이면 스킵) */
export function startDocAutoSnapshot(
  docId: string,
  getDraft: () => DocEntry | null,
  intervalMs = AUTO_INTERVAL_MS,
): () => void {
  stopDocAutoSnapshot(docId)
  const id = setInterval(() => {
    const draft = getDraft()
    if (!draft || draft.id !== docId) return
    createDocSnapshot({ doc: draft, kind: 'auto', note: '자동 스냅샷(5분)' })
  }, intervalMs)
  autoTimers.set(docId, id)
  return () => stopDocAutoSnapshot(docId)
}

export function stopDocAutoSnapshot(docId: string): void {
  const t = autoTimers.get(docId)
  if (t) {
    clearInterval(t)
    autoTimers.delete(docId)
  }
}

export const DOC_AUTO_SNAPSHOT_MS = AUTO_INTERVAL_MS
