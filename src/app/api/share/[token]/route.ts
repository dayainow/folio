import { NextResponse } from 'next/server'
import {
  deleteShare,
  getShare,
  isExpired,
  touchShare,
} from '@/lib/share-server-store'

export const runtime = 'nodejs'

type Ctx = { params: Promise<{ token: string }> }

async function sha256Hex(password: string): Promise<string> {
  const data = new TextEncoder().encode(`folio-share:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** GET /api/share/[token]?download=1&password= */
export async function GET(request: Request, ctx: Ctx) {
  const { token } = await ctx.params
  const share = await getShare(token)
  if (!share) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (isExpired(share)) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }

  const url = new URL(request.url)
  const password = url.searchParams.get('password') || request.headers.get('x-folio-share-password')
  if (share.passwordHash) {
    if (!password) {
      return NextResponse.json(
        { error: 'password_required', title: share.title, type: share.type },
        { status: 401 },
      )
    }
    const hash = await sha256Hex(password)
    if (hash !== share.passwordHash) {
      return NextResponse.json({ error: 'password_invalid' }, { status: 403 })
    }
  }

  const download = url.searchParams.get('download') === '1'
  await touchShare(token, download ? 'download' : 'view')

  if (download) {
    const filename = `${share.title.replace(/[\\/:*?"<>|]+/g, '-') || 'folio'}.md`
    return new NextResponse(share.snapshot.markdown, {
      status: 200,
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'x-folio-share-downloads': String(share.downloads + 1),
      },
    })
  }

  return NextResponse.json({
    token: share.token,
    title: share.title,
    type: share.type,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
    views: share.views + 1,
    downloads: share.downloads,
    markdown: share.snapshot.markdown,
    meta: share.snapshot.meta ?? {},
  })
}

/** DELETE /api/share/[token] */
export async function DELETE(_request: Request, ctx: Ctx) {
  const { token } = await ctx.params
  await deleteShare(token)
  return NextResponse.json({ ok: true })
}
