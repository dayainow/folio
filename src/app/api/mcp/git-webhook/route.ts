/**
 * POST /api/mcp/git-webhook
 * GitHub push webhook 또는 단순 JSON 커밋 페이로드 → Timeline/Journal/Board
 *
 * 인증 (하나라도 통과):
 * - Header `x-folio-mcp-secret: $FOLIO_MCP_WEBHOOK_SECRET`
 * - GitHub `X-Hub-Signature-256` (FOLIO_MCP_WEBHOOK_SECRET = webhook secret)
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { applyGitCommitToFolio, type GitCommitPayload } from '@/mcp/git-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function verifyGithubSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const provided = signature.slice('sha256='.length)
  try {
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(provided, 'utf8')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function authorized(req: Request, rawBody: string): boolean {
  const secret = process.env.FOLIO_MCP_WEBHOOK_SECRET?.trim()
  if (!secret) {
    // 로컬 개발: 시크릿 없으면 허용 (프로덕션에서는 반드시 설정)
    return process.env.NODE_ENV !== 'production'
  }
  const headerSecret = req.headers.get('x-folio-mcp-secret')
  if (headerSecret && headerSecret === secret) return true
  return verifyGithubSignature(rawBody, req.headers.get('x-hub-signature-256'), secret)
}

function commitsFromGithub(body: Record<string, unknown>): GitCommitPayload[] {
  const commits = Array.isArray(body.commits) ? body.commits : []
  const repo =
    body.repository && typeof body.repository === 'object'
      ? String((body.repository as { full_name?: string }).full_name ?? '')
      : ''
  const branch =
    typeof body.ref === 'string' ? body.ref.replace(/^refs\/heads\//, '') : undefined

  return commits.map((c) => {
    const commit = c as {
      id?: string
      message?: string
      url?: string
      author?: { name?: string; username?: string }
    }
    return {
      id: commit.id,
      message: commit.message ?? '(no message)',
      author: commit.author?.name || commit.author?.username,
      url: commit.url,
      branch,
      repository: repo || undefined,
    }
  })
}

/** POST /api/mcp/git-webhook */
export async function POST(req: Request) {
  const rawBody = await req.text()
  if (!authorized(req, rawBody)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // GitHub ping
  if (req.headers.get('x-github-event') === 'ping') {
    return NextResponse.json({ ok: true, ping: true })
  }

  let payloads: GitCommitPayload[] = []
  if (Array.isArray(body.commits)) {
    payloads = commitsFromGithub(body)
  } else if (typeof body.message === 'string') {
    payloads = [
      {
        id: typeof body.id === 'string' ? body.id : undefined,
        message: body.message,
        author: typeof body.author === 'string' ? body.author : undefined,
        url: typeof body.url === 'string' ? body.url : undefined,
        branch: typeof body.branch === 'string' ? body.branch : undefined,
        repository: typeof body.repository === 'string' ? body.repository : undefined,
      },
    ]
  }

  if (payloads.length === 0) {
    return NextResponse.json({ error: 'no_commits', hint: 'GitHub push 또는 { message } JSON' }, { status: 400 })
  }

  const results = []
  for (const commit of payloads) {
    results.push({
      message: commit.message.split('\n')[0],
      ...(await applyGitCommitToFolio(commit)),
    })
  }

  return NextResponse.json({ ok: true, count: results.length, results })
}
