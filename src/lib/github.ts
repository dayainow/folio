/**
 * GitHub Issues / PR API (서버 전용) — P39 고도화.
 * GITHUB_TOKEN, GITHUB_REPO (owner/name)
 */

export interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string
  state: 'open' | 'closed' | string
  htmlUrl: string
  labels: string[]
  /** login 목록 */
  assignees: string[]
  /** open / closed */
  stateReason?: string | null
  updatedAt?: string
  /** issues API에 PR이 섞여 올 때 */
  isPullRequest?: boolean
}

export interface GitHubPullRequest {
  id: number
  number: number
  title: string
  state: string
  merged: boolean
  htmlUrl: string
  body: string
  /** 닫히는 이슈 번호들 (#N / closes N) */
  closingIssues: number[]
  headRef?: string
  baseRef?: string
  user?: string
  mergedAt?: string | null
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

export function getGitHubRepo(): string | null {
  return getGitHubConfig()?.repo ?? null
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
  state_reason?: string | null
  html_url: string
  updated_at?: string
  labels?: Array<{ name?: string } | string>
  assignees?: Array<{ login?: string }>
  pull_request?: unknown
}

function mapIssue(raw: GhIssueRaw): GitHubIssue {
  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    body: raw.body ?? '',
    state: raw.state,
    stateReason: raw.state_reason ?? null,
    htmlUrl: raw.html_url,
    updatedAt: raw.updated_at,
    labels: (raw.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name ?? '')).filter(Boolean),
    assignees: (raw.assignees ?? []).map((a) => a.login ?? '').filter(Boolean),
    isPullRequest: Boolean(raw.pull_request),
  }
}

/** closes/fixes/resolves #N 파싱 */
export function extractClosingIssueNumbers(text: string): number[] {
  const re = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi
  const out = new Set<number>()
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const n = Number(m[1])
    if (Number.isFinite(n)) out.add(n)
  }
  // 본문/제목의 단독 #N 도 보조로 수집 (최대 5)
  for (const m2 of text.matchAll(/#(\d{1,6})\b/g)) {
    const n = Number(m2[1])
    if (Number.isFinite(n)) out.add(n)
    if (out.size >= 8) break
  }
  return [...out]
}

/** 열린+최근 닫힌 Issues (PR 제외) — 상태/담당자/라벨 포함 */
export async function fetchGitHubIssues(options?: {
  state?: 'open' | 'closed' | 'all'
  perPage?: number
}): Promise<GitHubIssue[]> {
  const cfg = getGitHubConfig()
  if (!cfg) return []

  const state = options?.state ?? 'open'
  const perPage = options?.perPage ?? 50
  const data = await githubFetch<GhIssueRaw[]>(
    `/repos/${cfg.repo}/issues?state=${state}&per_page=${perPage}&sort=updated`,
  )
  return data.filter((i) => !i.pull_request).map(mapIssue)
}

/** 단건 Issue */
export async function fetchGitHubIssue(number: number): Promise<GitHubIssue | null> {
  const cfg = getGitHubConfig()
  if (!cfg) return null
  try {
    const raw = await githubFetch<GhIssueRaw>(`/repos/${cfg.repo}/issues/${number}`)
    if (raw.pull_request) return null
    return mapIssue(raw)
  } catch {
    return null
  }
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

type GhPrRaw = {
  id: number
  number: number
  title: string
  body: string | null
  state: string
  merged: boolean
  html_url: string
  merged_at?: string | null
  user?: { login?: string }
  head?: { ref?: string }
  base?: { ref?: string }
}

function mapPr(raw: GhPrRaw): GitHubPullRequest {
  const body = raw.body ?? ''
  const title = raw.title ?? ''
  return {
    id: raw.id,
    number: raw.number,
    title,
    state: raw.state,
    merged: Boolean(raw.merged),
    htmlUrl: raw.html_url,
    body,
    closingIssues: extractClosingIssueNumbers(`${title}\n${body}`),
    headRef: raw.head?.ref,
    baseRef: raw.base?.ref,
    user: raw.user?.login,
    mergedAt: raw.merged_at ?? null,
  }
}

/** PR 단건 */
export async function fetchPullRequest(number: number): Promise<GitHubPullRequest | null> {
  const cfg = getGitHubConfig()
  if (!cfg) return null
  try {
    const raw = await githubFetch<GhPrRaw>(`/repos/${cfg.repo}/pulls/${number}`)
    return mapPr(raw)
  } catch {
    return null
  }
}

/**
 * Board 태스크에 GitHub 이슈 메타를 병합할 패치 맵.
 * key = githubIssueNumber
 */
export type GitHubBoardPatch = {
  githubIssueNumber: number
  githubUrl: string
  githubState: string
  githubAssignees: string[]
  githubLabels: string[]
  /** closed면 done 추천 */
  suggestStatus?: 'done'
}

export async function buildGitHubBoardPatches(
  issueNumbers: number[],
): Promise<GitHubBoardPatch[]> {
  const unique = [...new Set(issueNumbers.filter((n) => Number.isFinite(n) && n > 0))]
  const patches: GitHubBoardPatch[] = []
  for (const num of unique.slice(0, 40)) {
    const issue = await fetchGitHubIssue(num)
    if (!issue) continue
    patches.push({
      githubIssueNumber: issue.number,
      githubUrl: issue.htmlUrl,
      githubState: issue.state,
      githubAssignees: issue.assignees,
      githubLabels: issue.labels,
      suggestStatus: issue.state === 'closed' ? 'done' : undefined,
    })
  }
  return patches
}

/**
 * PR 머지 시 Board 태스크를 Done으로 이동 (MCP/Beacon 파일 스토어).
 * 매칭: githubIssueNumber ∈ closingIssues 또는 제목/설명에 #N / PR 번호
 */
export async function applyMergedPrToBoard(pr: GitHubPullRequest): Promise<{
  moved: Array<{ id: string; title: string; issueNumber?: number }>
  storePath?: string
}> {
  const { loadTasks, saveTasks } = await import('@/mcp/store')
  type Task = Awaited<ReturnType<typeof loadTasks>>[number] & {
    githubIssueNumber?: number
    githubUrl?: string
  }

  const tasks = (await loadTasks()) as Task[]
  const issueSet = new Set(pr.closingIssues)
  const moved: Array<{ id: string; title: string; issueNumber?: number }> = []
  const now = new Date().toISOString()

  const next = tasks.map((t) => {
    const num = t.githubIssueNumber
    const hay = `${t.title}\n${t.description ?? ''}`
    const matchIssue = typeof num === 'number' && issueSet.has(num)
    const matchPrText =
      hay.includes(`#${pr.number}`) ||
      /\bpr[#\s-]*(\d+)/i.test(hay) && Number(hay.match(/\bpr[#\s-]*(\d+)/i)?.[1]) === pr.number
    const matchClosingInTitle = pr.closingIssues.some((n) => hay.includes(`#${n}`))

    if (!(matchIssue || matchPrText || matchClosingInTitle)) return t
    if (t.status === 'done') return t

    moved.push({ id: t.id, title: t.title, issueNumber: num })
    return {
      ...t,
      status: 'done' as const,
      updatedAt: now,
      githubUrl: t.githubUrl || pr.htmlUrl,
    }
  })

  let storePath: string | undefined
  if (moved.length > 0) {
    storePath = await saveTasks(next)
  }

  return { moved, storePath }
}
