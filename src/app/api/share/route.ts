import { NextResponse } from 'next/server'
import { getShare, putShare, type StoredShare } from '@/lib/share-server-store'
import type { ShareSnapshot } from '@/lib/share-links'

export const runtime = 'nodejs'

/** POST /api/share — 공유 스냅샷 생성 */
export async function POST(request: Request) {
  let body: {
    token?: string
    passwordHash?: string | null
    expiresAt?: string | null
    snapshot?: ShareSnapshot
    title?: string
    type?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const token = body.token?.trim()
  const snapshot = body.snapshot
  if (!token || !snapshot?.html || !snapshot?.markdown || !snapshot?.title) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }
  if (token.length < 16 || token.length > 128) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 })
  }

  const existing = await getShare(token)
  if (existing) {
    return NextResponse.json({ error: 'token_exists' }, { status: 409 })
  }

  const share: StoredShare = {
    token,
    title: body.title || snapshot.title,
    type: body.type || snapshot.type,
    passwordHash: body.passwordHash ?? null,
    expiresAt: body.expiresAt ?? null,
    createdAt: new Date().toISOString(),
    views: 0,
    downloads: 0,
    snapshot,
  }
  await putShare(share)
  return NextResponse.json({
    ok: true,
    token,
    createdAt: share.createdAt,
  })
}
