/**
 * GET /api/github/sync?numbers=1,2,3
 * Board에 연결된 Issue 상태/담당자/라벨을 조회해 패치로 반환
 *
 * POST /api/github/sync — { numbers: number[] } 동일
 */
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseNumbers(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw.map(Number).filter((n) => Number.isFinite(n) && n > 0)
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,\s]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0)
  }
  return []
}

export async function GET(request: Request) {
  try {
    const { isGitHubConfigured, fetchGitHubIssues, buildGitHubBoardPatches } =
      await import('@/lib/github')
    if (!isGitHubConfigured()) {
      return NextResponse.json({ enabled: false, patches: [], issues: [] })
    }

    const url = new URL(request.url)
    const numbers = parseNumbers(url.searchParams.get('numbers') ?? '')

    if (numbers.length > 0) {
      const patches = await buildGitHubBoardPatches(numbers)
      return NextResponse.json({ enabled: true, patches })
    }

    // 번호 없으면 open issues 전체 메타
    const issues = await fetchGitHubIssues({ state: 'all', perPage: 30 })
    const patches = issues.map((i) => ({
      githubIssueNumber: i.number,
      githubUrl: i.htmlUrl,
      githubState: i.state,
      githubAssignees: i.assignees,
      githubLabels: i.labels,
      suggestStatus: i.state === 'closed' ? ('done' as const) : undefined,
    }))
    return NextResponse.json({ enabled: true, patches, issues })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'GitHub sync 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { isGitHubConfigured, buildGitHubBoardPatches } = await import('@/lib/github')
    if (!isGitHubConfigured()) {
      return NextResponse.json({ enabled: false, patches: [] })
    }
    const body = (await request.json()) as { numbers?: number[] }
    const numbers = parseNumbers(body.numbers)
    const patches = await buildGitHubBoardPatches(numbers)
    return NextResponse.json({ enabled: true, patches })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'GitHub sync 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
