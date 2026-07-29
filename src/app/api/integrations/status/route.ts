import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/** GET /api/integrations/status — 클라이언트용 연동 가능 여부 */
export async function GET() {
  const [{ isDiscordConfigured }, { isGitHubConfigured }, { isSlackConfigured }] = await Promise.all([
    import('@/lib/discord'),
    import('@/lib/github'),
    import('@/lib/slack'),
  ])

  const repo = process.env.GITHUB_REPO
  const githubRepo =
    repo && repo !== 'owner/repo' && repo.includes('/') ? repo : null

  return NextResponse.json({
    slack: isSlackConfigured(),
    discord: isDiscordConfigured(),
    github: isGitHubConfigured(),
    githubRepo: isGitHubConfigured() ? githubRepo : null,
  })
}
