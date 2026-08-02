/**
 * P45 — 초대 링크 커스터마이징 (메모 · 최대 사용 횟수)
 */
'use client'

export type InviteLinkMeta = {
  token: string
  /** 초대 메시지/메모 */
  note?: string
  /** 수락 가능 횟수 (미설정 = 무제한) */
  maxUses?: number
  uses: number
  createdAt: string
}

const KEY = 'folio_invite_link_meta_v1'

function readMap(): Record<string, InviteLinkMeta> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, InviteLinkMeta>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: Record<string, InviteLinkMeta>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function saveInviteLinkMeta(input: {
  token: string
  note?: string
  maxUses?: number
}): InviteLinkMeta {
  const map = readMap()
  const prev = map[input.token]
  const meta: InviteLinkMeta = {
    token: input.token,
    note: input.note?.trim() || prev?.note,
    maxUses: input.maxUses ?? prev?.maxUses,
    uses: prev?.uses ?? 0,
    createdAt: prev?.createdAt ?? new Date().toISOString(),
  }
  map[input.token] = meta
  writeMap(map)
  return meta
}

export function getInviteLinkMeta(token: string): InviteLinkMeta | null {
  return readMap()[token] ?? null
}

export function canUseInviteLink(token: string): { ok: boolean; reason?: string } {
  const meta = getInviteLinkMeta(token)
  if (!meta?.maxUses) return { ok: true }
  if (meta.uses >= meta.maxUses) return { ok: false, reason: '초대 링크 사용 횟수를 초과했습니다.' }
  return { ok: true }
}

export function recordInviteLinkUse(token: string): void {
  const map = readMap()
  const meta = map[token]
  if (!meta) return
  map[token] = { ...meta, uses: meta.uses + 1 }
  writeMap(map)
}

/** 커스텀 쿼리 포함 초대 URL */
export function buildCustomInviteLink(token: string, opts?: { note?: string }): string {
  if (typeof window === 'undefined') {
    return `/?invite=${encodeURIComponent(token)}`
  }
  const url = new URL(window.location.origin)
  url.searchParams.set('invite', token)
  if (opts?.note?.trim()) url.searchParams.set('note', opts.note.trim().slice(0, 80))
  return url.toString()
}
