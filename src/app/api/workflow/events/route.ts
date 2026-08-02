/**
 * POST /api/workflow/events
 * { kind, title, message, ... } → Slack/Discord/Board/Gate 핸들러
 */
import { NextResponse } from 'next/server'
import type { WorkflowEvent } from '@/lib/workflow-events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WorkflowEvent
    if (!body?.kind || !body?.title?.trim()) {
      return NextResponse.json({ error: 'kind와 title이 필요합니다.' }, { status: 400 })
    }

    const {
      dispatchWorkflowEvent,
      onSaveEvent,
      onJiraIssueUpdated,
      onBeaconGateChange,
      onGitHubPrMerged,
    } = await import('@/lib/workflow-events')

    let result
    switch (body.kind) {
      case 'save':
        result = await onSaveEvent({
          title: body.title,
          message: body.message,
          actionUrl: body.actionUrl,
        })
        break
      case 'jira_sync':
        result = await onJiraIssueUpdated({
          jiraKey: body.jiraKey || 'JIRA',
          summary: body.message || body.title,
          status: body.fields?.find((f) => f.name === 'Status')?.value,
        })
        break
      case 'gate_change':
        result = await onBeaconGateChange({
          name: body.gate?.name || body.title,
          progressPercent: body.gate?.progressPercent,
          status: body.gate?.status,
          message: body.message,
        })
        break
      case 'github_pr_merged':
        result = await onGitHubPrMerged({
          prNumber: body.github?.prNumber || 0,
          title: body.title,
          url: body.github?.url,
        })
        break
      default:
        result = await dispatchWorkflowEvent({
          ...body,
          notify: body.notify !== false,
        })
    }

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'workflow event 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
