/**
 * GitHub Issues API (서버 전용).
 * GITHUB_TOKEN, GITHUB_REPO (owner/name)
 */

export interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string
  state: string
  htmlUrl: string
  labels: string[]
}

function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO

  if (
    !token ||
    !repo ||
    token === 'your-github-token' ||
    repo === 'owner/repo' ||
    !repo.includes('/')
  ) {
    return null
  }

  return { token, repo }
}

export function isGitHubConfigured(): boolean {
  return getGitHubConfig() !== null
}

async function githubFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cfg = getGitHubConfig()
  if (!cfg) {
    throw new Error('GitHub env가 없습니다. GITHUB_TOKEN / GITHUB_REPO 를 설정하세요.')
  }

  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub API ${res.status}: ${body || res.statusText}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

type GhIssueRaw = {
  id: number
  number: number
  title: string
  body: string | null
  state: string
  html_url: string
  labels?: Array<{ name?: string } | string>
}

function mapIssue(raw: GhIssueRaw): GitHubIssue {
  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    body: raw.body ?? '',
    state: raw.state,
    htmlUrl: raw.html_url,
    labels: (raw.labels ?? []).map(l => (typeof l === 'string' ? l : l.name ?? '')).filter(Boolean),
  }
}

/** 열린 Issues 목록 */
export async function fetchGitHubIssues(): Promise<GitHubIssue[]> {
  const cfg = getGitHubConfig()
  if (!cfg) return []

  const data = await githubFetch<GhIssueRaw[]>(
    `/repos/${cfg.repo}/issues?state=open&per_page=50`,
  )
  // PRs are also returned by issues API — filter them out
  return data.filter(i => !('pull_request' in i)).map(mapIssue)
}

/** Issue 생성 */
export async function createGithubIssue(title: string, body = ''): Promise<GitHubIssue> {
  const cfg = getGitHubConfig()
  if (!cfg) {
    throw new Error('GitHub env가 없습니다. GITHUB_TOKEN / GITHUB_REPO 를 설정하세요.')
  }

  const raw = await githubFetch<GhIssueRaw>(`/repos/${cfg.repo}/issues`, {
    method: 'POST',
    body: JSON.stringify({
      title: title.trim(),
      body: body.trim() || undefined,
    }),
  })

  return mapIssue(raw)
}
