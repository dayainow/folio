/**
 * P60 — 서버측 공유 스냅샷 저장 (메모리 + .data/shares 파일)
 */
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import type { ShareSnapshot } from '@/lib/share-links'

export type StoredShare = {
  token: string
  title: string
  type: string
  passwordHash: string | null
  expiresAt: string | null
  createdAt: string
  views: number
  downloads: number
  snapshot: ShareSnapshot
}

type GlobalShares = {
  map: Map<string, StoredShare>
}

function g(): GlobalShares {
  const key = '__folio_share_store__'
  const root = globalThis as typeof globalThis & { [key]?: GlobalShares }
  if (!root[key]) root[key] = { map: new Map() }
  return root[key]!
}

function shareDir() {
  return path.join(process.cwd(), '.data', 'shares')
}

export function isValidShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{16,128}$/.test(token)
}

function sharePath(token: string): string {
  if (!isValidShareToken(token)) throw new Error('invalid_share_token')
  return path.join(shareDir(), `${token}.json`)
}

async function persist(share: StoredShare) {
  try {
    await mkdir(shareDir(), { recursive: true })
    await writeFile(
      sharePath(share.token),
      `${JSON.stringify(share)}\n`,
      'utf8',
    )
  } catch {
    /* readonly fs — memory only */
  }
}

async function loadFromDisk(token: string): Promise<StoredShare | null> {
  if (!isValidShareToken(token)) return null
  try {
    const raw = await readFile(sharePath(token), 'utf8')
    return JSON.parse(raw) as StoredShare
  } catch {
    return null
  }
}

export async function putShare(share: StoredShare): Promise<void> {
  if (!isValidShareToken(share.token)) throw new Error('invalid_share_token')
  g().map.set(share.token, share)
  await persist(share)
}

export async function getShare(token: string): Promise<StoredShare | null> {
  if (!isValidShareToken(token)) return null
  const mem = g().map.get(token)
  if (mem) return mem
  const disk = await loadFromDisk(token)
  if (disk) g().map.set(token, disk)
  return disk
}

export async function deleteShare(token: string): Promise<boolean> {
  if (!isValidShareToken(token)) return false
  g().map.delete(token)
  try {
    await unlink(sharePath(token))
    return true
  } catch {
    return true
  }
}

export async function touchShare(
  token: string,
  kind: 'view' | 'download',
): Promise<StoredShare | null> {
  const share = await getShare(token)
  if (!share) return null
  if (kind === 'view') share.views += 1
  else share.downloads += 1
  await putShare(share)
  return share
}

export function isExpired(share: StoredShare): boolean {
  if (!share.expiresAt) return false
  return Date.parse(share.expiresAt) <= Date.now()
}
