/**
 * P41 — 문서 주석 · @멘션 · 해결/미해결
 */
'use client'

import { publishActivity } from '@/lib/activity-stream'

export type CommentTarget = {
  /** 'doc' | 'journal' */
  kind: 'doc' | 'journal'
  id: string
}

export type DocComment = {
  id: string
  targetKind: 'doc' | 'journal'
  targetId: string
  body: string
  /** @멘션된 사용자 식별자 (email 또는 userId) */
  mentions: string[]
  authorId: string
  authorName: string
  resolved: boolean
  createdAt: string
  updatedAt: string
  /** 선택 영역 (optional) */
  anchor?: { start: number; end: number } | null
}

const STORAGE_KEY = 'folio_doc_comments_v1'

function readAll(): DocComment[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as DocComment[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(items: DocComment[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent('folio-comments-changed'))
  } catch {
    /* ignore */
  }
}

/** `@alice` `@user@example.com` 형태 추출 */
export function parseMentions(body: string): string[] {
  const found = new Set<string>()
  const re = /@([^\s@]+(?:@[^\s@]+)?)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const token = m[1]?.trim()
    if (token) found.add(token)
  }
  return [...found]
}

export function listComments(target: CommentTarget): DocComment[] {
  return readAll()
    .filter((c) => c.targetKind === target.kind && c.targetId === target.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function addComment(input: {
  target: CommentTarget
  body: string
  authorId: string
  authorName: string
  anchor?: { start: number; end: number } | null
}): DocComment {
  const now = new Date().toISOString()
  const comment: DocComment = {
    id: crypto.randomUUID(),
    targetKind: input.target.kind,
    targetId: input.target.id,
    body: input.body.trim(),
    mentions: parseMentions(input.body),
    authorId: input.authorId,
    authorName: input.authorName,
    resolved: false,
    createdAt: now,
    updatedAt: now,
    anchor: input.anchor ?? null,
  }
  const all = readAll()
  all.unshift(comment)
  writeAll(all)

  void publishActivity({
    type: 'comment',
    actorId: input.authorId,
    actorName: input.authorName,
    targetKind: input.target.kind,
    targetId: input.target.id,
    summary: `주석: ${comment.body.slice(0, 80)}`,
    meta: { commentId: comment.id, mentions: comment.mentions },
  })

  return comment
}

export function setCommentResolved(commentId: string, resolved: boolean): DocComment | null {
  const all = readAll()
  const idx = all.findIndex((c) => c.id === commentId)
  if (idx < 0) return null
  const next = {
    ...all[idx]!,
    resolved,
    updatedAt: new Date().toISOString(),
  }
  all[idx] = next
  writeAll(all)
  return next
}

export function deleteComment(commentId: string): boolean {
  const all = readAll()
  const next = all.filter((c) => c.id !== commentId)
  if (next.length === all.length) return false
  writeAll(next)
  return true
}

export function subscribeComments(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = () => cb()
  window.addEventListener('folio-comments-changed', handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('folio-comments-changed', handler)
    window.removeEventListener('storage', handler)
  }
}
