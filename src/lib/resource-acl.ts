/**
 * P45 — 문서/보드 세부 ACL (역할 + 리소스 권한)
 * localStorage 기반 · Supabase share와 병행
 */
'use client'

export type ResourceKind = 'doc' | 'board' | 'journal'

/** view < comment < edit < admin */
export type ResourceAccess = 'view' | 'comment' | 'edit' | 'admin'

export type ResourceAclEntry = {
  id: string
  kind: ResourceKind
  resourceId: string
  /** userId 또는 email 또는 'team:<teamId>' 또는 'guest' */
  subject: string
  access: ResourceAccess
  updatedAt: string
}

const KEY = 'folio_resource_acl_v1'
const CHANGE = 'folio-resource-acl'

const ORDER: ResourceAccess[] = ['view', 'comment', 'edit', 'admin']

export function accessAtLeast(have: ResourceAccess, need: ResourceAccess): boolean {
  return ORDER.indexOf(have) >= ORDER.indexOf(need)
}

function readAll(): ResourceAclEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ResourceAclEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(items: ResourceAclEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent(CHANGE))
  } catch {
    /* ignore */
  }
}

export function listResourceAcl(kind: ResourceKind, resourceId: string): ResourceAclEntry[] {
  return readAll().filter((e) => e.kind === kind && e.resourceId === resourceId)
}

export function setResourceAcl(input: {
  kind: ResourceKind
  resourceId: string
  subject: string
  access: ResourceAccess
}): ResourceAclEntry {
  const all = readAll().filter(
    (e) =>
      !(e.kind === input.kind && e.resourceId === input.resourceId && e.subject === input.subject),
  )
  const entry: ResourceAclEntry = {
    id: crypto.randomUUID(),
    kind: input.kind,
    resourceId: input.resourceId,
    subject: input.subject,
    access: input.access,
    updatedAt: new Date().toISOString(),
  }
  writeAll([entry, ...all])
  return entry
}

export function removeResourceAcl(id: string): void {
  writeAll(readAll().filter((e) => e.id !== id))
}

/** 주체 목록에 대한 최대 권한 (없으면 null) */
export function resolveResourceAccess(
  kind: ResourceKind,
  resourceId: string,
  subjects: string[],
): ResourceAccess | null {
  const rows = listResourceAcl(kind, resourceId).filter((e) => subjects.includes(e.subject))
  if (!rows.length) return null
  return rows.reduce<ResourceAccess>((best, row) => {
    return accessAtLeast(row.access, best) ? row.access : best
  }, 'view')
}

export function subscribeResourceAcl(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const h = () => cb()
  window.addEventListener(CHANGE, h)
  window.addEventListener('storage', h)
  return () => {
    window.removeEventListener(CHANGE, h)
    window.removeEventListener('storage', h)
  }
}
