/**
 * P60 — 읽기 전용 공유 링크 (암호 · 만료 · 다운로드 추적 · 임베드)
 */
'use client'

import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache'

export type ShareResourceType = 'doc' | 'journal' | 'board' | 'bundle'

export type ShareSnapshot = {
  type: ShareResourceType
  title: string
  /** HTML 미리보기용 */
  html: string
  /** 원본 마크다운/텍스트 */
  markdown: string
  meta?: Record<string, string>
}

export type ShareLinkRecord = {
  token: string
  createdAt: string
  expiresAt: string | null
  passwordHash: string | null
  title: string
  type: ShareResourceType
  views: number
  downloads: number
  /** 생성자 표시용 */
  ownerHint?: string
}

const REGISTRY_KEY = 'folio_share_links_v1'

function loadRegistry(): ShareLinkRecord[] {
  const list = getLocalJson<ShareLinkRecord[]>(REGISTRY_KEY, [])
  return Array.isArray(list) ? list : []
}

function saveRegistry(list: ShareLinkRecord[]) {
  setLocalJson(REGISTRY_KEY, list.slice(0, 100))
  flushLocalJson(REGISTRY_KEY)
}

export function listShareLinks(): ShareLinkRecord[] {
  return loadRegistry().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function deleteLocalShareLink(token: string) {
  saveRegistry(loadRegistry().filter((l) => l.token !== token))
}

export async function hashSharePassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`folio-share:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function generateShareToken(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function buildShareUrl(token: string, opts?: { embed?: boolean; origin?: string }): string {
  const origin =
    opts?.origin ??
    (typeof window !== 'undefined' ? window.location.origin : '')
  const q = opts?.embed ? '?embed=1' : ''
  return `${origin}/share/${token}${q}`
}

export function buildEmbedCode(token: string, opts?: { height?: number; origin?: string }): string {
  const src = buildShareUrl(token, { embed: true, origin: opts?.origin })
  const h = opts?.height ?? 480
  return `<iframe src="${src}" title="Folio embed" width="100%" height="${h}" style="border:0;border-radius:12px;" loading="lazy" referrerpolicy="no-referrer"></iframe>`
}

export function isShareExpired(link: Pick<ShareLinkRecord, 'expiresAt'>): boolean {
  if (!link.expiresAt) return false
  return Date.parse(link.expiresAt) <= Date.now()
}

export type CreateShareInput = {
  snapshot: ShareSnapshot
  password?: string
  /** ISO date or null */
  expiresAt?: string | null
  ownerHint?: string
}

/** 서버에 스냅샷 등록 + 로컬 레지스트리 */
export async function createShareLink(input: CreateShareInput): Promise<{
  link: ShareLinkRecord
  url: string
  embedCode: string
}> {
  const token = generateShareToken()
  const passwordHash = input.password ? await hashSharePassword(input.password) : null
  const link: ShareLinkRecord = {
    token,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt ?? null,
    passwordHash,
    title: input.snapshot.title,
    type: input.snapshot.type,
    views: 0,
    downloads: 0,
    ownerHint: input.ownerHint,
  }

  const { csrfHeaders } = await import('@/lib/csrf')
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...csrfHeaders(),
    },
    body: JSON.stringify({
      token,
      passwordHash,
      expiresAt: link.expiresAt,
      snapshot: input.snapshot,
      title: link.title,
      type: link.type,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `share_create_failed_${res.status}`)
  }

  const registry = loadRegistry()
  registry.unshift(link)
  saveRegistry(registry)

  return {
    link,
    url: buildShareUrl(token),
    embedCode: buildEmbedCode(token),
  }
}

export async function revokeShareLink(token: string): Promise<void> {
  const { csrfHeaders } = await import('@/lib/csrf')
  await fetch(`/api/share/${encodeURIComponent(token)}`, {
    method: 'DELETE',
    headers: { ...csrfHeaders() },
  }).catch(() => undefined)
  deleteLocalShareLink(token)
}

export function bumpLocalShareStat(token: string, kind: 'view' | 'download') {
  const list = loadRegistry()
  const i = list.findIndex((l) => l.token === token)
  if (i < 0) return
  const cur = list[i]!
  list[i] = {
    ...cur,
    views: kind === 'view' ? cur.views + 1 : cur.views,
    downloads: kind === 'download' ? cur.downloads + 1 : cur.downloads,
  }
  saveRegistry(list)
}
