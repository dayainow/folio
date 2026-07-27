import { NextResponse } from 'next/server'
import {
  fetchIssues,
  mapJiraPriorityToBoard,
  mapJiraStatusToBoard,
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
