/**
 * POST /api/github/webhook
 * GitHub pull_request / issues / workflow_run 이벤트 → Folio Board · Discord/Slack
 *
 * 인증: X-Hub-Signature-256 (FOLIO_MCP_WEBHOOK_SECRET 또는 GITHUB_WEBHOOK_SECRET)
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function webhookSecret(): string | undefined {
  return (
    process.env.GITHUB_WEBHOOK_SECRET?.trim() ||
    process.env.FOLIO_MCP_WEBHOOK_SECRET?.trim() ||
    undefined
  )
}

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
  const secret = webhookSecret()
  if (!secret) {
    return process.env.NODE_ENV !== 'production'
  }
  const headerSecret = req.headers.get('x-folio-mcp-secret')
  if (headerSecret && headerSecret === secret) return true
  return verifyGithubSignature(rawBody, req.headers.get('x-hub-signature-256'), secret)
}

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

  const event = req.headers.get('x-github-event') || 'unknown'

  if (event === 'ping') {
    return NextResponse.json({ ok: true, ping: true })
  }

  const {
    onGitHubPrMerged,
    dispatchWorkflowEvent,
  } = await import('@/lib/workflow-events')

  // PR merged → Board Done
  if (event === 'pull_request') {
    const action = String(body.action ?? '')
    const pr = body.pull_request as
      | {
          number?: number
          title?: string
          html_url?: string
          merged?: boolean
          body?: string
        }
      | undefined

    if (action === 'closed' && pr?.merged && pr.number) {
      const { extractClosingIssueNumbers } = await import('@/lib/github')
      const closing = extractClosingIssueNumbers(`${pr.title ?? ''}\n${pr.body ?? ''}`)
      const result = await onGitHubPrMerged({
        prNumber: pr.number,
        title: pr.title ?? `PR #${pr.number}`,
        url: pr.html_url,
        closingIssues: closing,
      })
      return NextResponse.json({ ok: true, event, action, result })
    }

    return NextResponse.json({ ok: true, event, action, skipped: true })
  }

  // Issue 상태 변경 알림
  if (event === 'issues') {
    const action = String(body.action ?? '')
    const issue = body.issue as
      | {
          number?: number
          title?: string
          html_url?: string
          state?: string
          assignees?: Array<{ login?: string }>
          labels?: Array<{ name?: string } | string>
        }
      | undefined

    if (issue?.number && (action === 'closed' || action === 'reopened' || action === 'labeled')) {
      const assignees = (issue.assignees ?? []).map((a) => a.login).filter(Boolean).join(', ')
      const labels = (issue.labels ?? [])
        .map((l) => (typeof l === 'string' ? l : l.name))
        .filter(Boolean)
        .join(', ')
      const result = await dispatchWorkflowEvent({
        kind: 'github_issue_updated',
        title: `Issue #${issue.number} ${action}`,
        message: issue.title ?? '',
        github: {
          issueNumber: issue.number,
          state: issue.state,
          url: issue.html_url,
        },
        fields: [
          { name: 'State', value: issue.state ?? '—', inline: true },
          ...(assignees ? [{ name: 'Assignees', value: assignees, inline: true }] : []),
          ...(labels ? [{ name: 'Labels', value: labels }] : []),
        ],
        actionUrl: '/?tab=board',
        notify: true,
      })
      return NextResponse.json({ ok: true, event, action, result })
    }

    return NextResponse.json({ ok: true, event, action, skipped: true })
  }

  // GitHub Actions workflow_run
  if (event === 'workflow_run') {
    const action = String(body.action ?? '')
    const run = body.workflow_run as
      | {
          name?: string
          conclusion?: string | null
          html_url?: string
          status?: string
          head_branch?: string
        }
      | undefined

    if (action === 'completed' && run) {
      const ok = run.conclusion === 'success'
      const result = await dispatchWorkflowEvent({
        kind: ok ? 'info' : 'warning',
        title: `Actions · ${run.name ?? 'workflow'}`,
        message: `${run.conclusion ?? run.status ?? 'completed'} · ${run.head_branch ?? ''}`.trim(),
        fields: [
          { name: 'Conclusion', value: run.conclusion ?? '—', inline: true },
          { name: 'Branch', value: run.head_branch ?? '—', inline: true },
        ],
        actionUrl: run.html_url,
        notify: true,
      })
      return NextResponse.json({ ok: true, event, action, result })
    }

    return NextResponse.json({ ok: true, event, action, skipped: true })
  }

  return NextResponse.json({ ok: true, event, skipped: true, hint: 'unsupported event' })
}
