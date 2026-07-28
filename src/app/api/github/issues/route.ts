import { NextResponse } from 'next/server'
import {
  createGithubIssue,
  fetchGitHubIssues,
  isGitHubConfigured,
} from '@/lib/github'

export const runtime = 'nodejs'

/** GET /api/github/issues */
export async function GET() {
  try {
    if (!isGitHubConfigured()) {
      return NextResponse.json({ enabled: false, issues: [] })
    }
    const issues = await fetchGitHubIssues()
    return NextResponse.json({ enabled: true, issues })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'GitHub 조회 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST /api/github/issues — { title, body? } */
export async function POST(request: Request) {
  try {
    if (!isGitHubConfigured()) {
      return NextResponse.json({ error: 'GitHub가 설정되지 않았습니다.' }, { status: 400 })
    }
    const body = (await request.json()) as { title?: string; body?: string }
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'title이 필요합니다.' }, { status: 400 })
    }
    const issue = await createGithubIssue(body.title, body.body ?? '')
    return NextResponse.json({ issue })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'GitHub 이슈 생성 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
