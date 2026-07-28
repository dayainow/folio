import { NextResponse } from 'next/server'
import { isDiscordConfigured } from '@/lib/discord'
import { isGitHubConfigured } from '@/lib/github'
import { isSlackConfigured } from '@/lib/slack'

export const runtime = 'nodejs'

/** GET /api/integrations/status — 클라이언트용 연동 가능 여부 */
export async function GET() {
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
