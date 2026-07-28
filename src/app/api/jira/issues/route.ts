import { NextResponse } from 'next/server'
import {
  createIssue,
  fetchIssues,
  mapJiraPriorityToBoard,
  mapJiraStatusToBoard,
  transitionIssue,
} from '@/lib/jira'

export const runtime = 'nodejs'

/** GET /api/jira/issues?projectKey=XXX — Jira 이슈를 Board 태스크 형태로 반환 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectKey = searchParams.get('projectKey') ?? undefined
    const issues = await fetchIssues(projectKey)

    const tasks = issues.map(issue => ({
      id: `jira-${issue.key}`,
      title: issue.summary,
      description: issue.description,
      status: mapJiraStatusToBoard(issue.status, issue.statusCategory),
      priority: mapJiraPriorityToBoard(issue.priority),
      tags: ['jira', issue.issueType.toLowerCase()],
      jiraKey: issue.key,
      jiraUrl: issue.url,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    return NextResponse.json({ issues, tasks })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Jira 동기화 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/jira/issues
 * body: { action: 'create', summary, description?, issueType? }
 *    or { action: 'transition', issueIdOrKey, transitionName }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string
      summary?: string
      description?: string
      issueType?: string
      projectKey?: string
      issueIdOrKey?: string
      transitionName?: string
    }

    if (body.action === 'transition') {
      if (!body.issueIdOrKey || !body.transitionName) {
        return NextResponse.json(
          { error: 'issueIdOrKey와 transitionName이 필요합니다.' },
          { status: 400 },
        )
      }
      await transitionIssue(body.issueIdOrKey, body.transitionName)
      return NextResponse.json({ ok: true })
    }

    if (!body.summary?.trim()) {
      return NextResponse.json({ error: 'summary가 필요합니다.' }, { status: 400 })
    }

    const issue = await createIssue(
      body.summary.trim(),
      body.description ?? '',
      body.issueType || 'Task',
      body.projectKey,
    )

    return NextResponse.json({
      issue,
      task: {
        id: `jira-${issue.key}`,
        title: issue.summary,
        description: issue.description,
        status: mapJiraStatusToBoard(issue.status, issue.statusCategory),
        priority: mapJiraPriorityToBoard(issue.priority),
        tags: ['jira', issue.issueType.toLowerCase()],
        jiraKey: issue.key,
        jiraUrl: issue.url,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Jira 요청 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
