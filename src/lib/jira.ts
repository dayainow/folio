/**
 * Jira Cloud REST API 클라이언트 (서버 전용).
 * 환경변수: JIRA_API_TOKEN, JIRA_EMAIL, JIRA_DOMAIN, JIRA_PROJECT_KEY
 */

export type BoardStatus = 'backlog' | 'in_progress' | 'review' | 'done'
export type BoardPriority = 'low' | 'medium' | 'high'

export interface JiraIssue {
  id: string
  key: string
  summary: string
  description: string
  status: string
  statusCategory?: string
  priority: string
  issueType: string
  url: string
}

function getJiraConfig() {
  const token = process.env.JIRA_API_TOKEN
  const email = process.env.JIRA_EMAIL
  const domain = process.env.JIRA_DOMAIN
  const projectKey = process.env.JIRA_PROJECT_KEY

  if (!token || !email || !domain || token === 'your-api-token' || email === 'your-email' || domain === 'your-domain') {
    throw new Error(
      'Jira env가 없습니다. JIRA_API_TOKEN / JIRA_EMAIL / JIRA_DOMAIN / JIRA_PROJECT_KEY 를 .env.local에 설정하세요.',
    )
  }

  const host = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/\.atlassian\.net$/i, '')
  const baseUrl = `https://${host}.atlassian.net/rest/api/3`

  return { token, email, baseUrl, browseBase: `https://${host}.atlassian.net/browse`, projectKey: projectKey || 'PROJ' }
}

function authHeader(email: string, token: string) {
  const raw = Buffer.from(`${email}:${token}`).toString('base64')
  return `Basic ${raw}`
}

async function jiraFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { token, email, baseUrl } = getJiraConfig()
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(email, token),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Jira API ${res.status}: ${body || res.statusText}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function extractAdfText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { type?: string; text?: string; content?: unknown[] }
  if (n.type === 'text' && n.text) return n.text
  if (Array.isArray(n.content)) return n.content.map(extractAdfText).join('')
  return ''
}

export function mapJiraStatusToBoard(statusName: string, statusCategory?: string): BoardStatus {
  const name = statusName.toLowerCase().trim()
  const category = (statusCategory ?? '').toLowerCase().trim()

  if (
    name.includes('done') ||
    name.includes('closed') ||
    name.includes('resolved') ||
    name.includes('complete') ||
    category === 'done'
  ) {
    return 'done'
  }
  if (
    name.includes('review') ||
    name.includes('qa') ||
    name.includes('testing') ||
    name.includes('verify')
  ) {
    return 'review'
  }
  if (
    name.includes('progress') ||
    name.includes('doing') ||
    name.includes('development') ||
    category === 'indeterminate'
  ) {
    return 'in_progress'
  }
  // To Do / Open / Backlog 등
  return 'backlog'
}

export function mapJiraPriorityToBoard(priorityName: string): BoardPriority {
  const name = priorityName.toLowerCase()
  if (name.includes('highest') || name.includes('high') || name.includes('critical')) return 'high'
  if (name.includes('lowest') || name.includes('low')) return 'low'
  return 'medium'
}

type JiraSearchResponse = {
  issues?: Array<{
    id: string
    key: string
    fields: {
      summary?: string
      description?: unknown
      status?: { name?: string; statusCategory?: { name?: string; key?: string } }
      priority?: { name?: string }
      issuetype?: { name?: string }
    }
  }>
}

/** 프로젝트 이슈 목록 조회 (POST /rest/api/3/search/jql) */
export async function fetchIssues(projectKey?: string): Promise<JiraIssue[]> {
  const { projectKey: defaultKey, browseBase } = getJiraConfig()
  const key = projectKey || defaultKey
  const data = await jiraFetch<JiraSearchResponse>('/search/jql', {
    method: 'POST',
    body: JSON.stringify({
      jql: `project = "${key}" ORDER BY updated DESC`,
      maxResults: 50,
      fields: ['summary', 'description', 'status', 'priority', 'issuetype'],
    }),
  })

  return (data.issues ?? []).map(issue => {
    const statusName = issue.fields.status?.name ?? 'To Do'
    const statusCategory =
      issue.fields.status?.statusCategory?.key ?? issue.fields.status?.statusCategory?.name
    return {
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary ?? '(제목 없음)',
      description: extractAdfText(issue.fields.description),
      status: statusName,
      statusCategory,
      priority: issue.fields.priority?.name ?? 'Medium',
      issueType: issue.fields.issuetype?.name ?? 'Task',
      url: `${browseBase}/${issue.key}`,
    }
  })
}

function toAdfDescription(text: string) {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: text
          ? [{ type: 'text', text }]
          : [],
      },
    ],
  }
}

/** 이슈 생성 */
export async function createIssue(
  summary: string,
  description: string,
  issueType = 'Task',
  projectKey?: string,
): Promise<JiraIssue> {
  const { projectKey: defaultKey, browseBase } = getJiraConfig()
  const key = projectKey || defaultKey

  const created = await jiraFetch<{ id: string; key: string }>('/issue', {
    method: 'POST',
    body: JSON.stringify({
      fields: {
        project: { key },
        summary,
        description: toAdfDescription(description),
        issuetype: { name: issueType },
      },
    }),
  })

  return {
    id: created.id,
    key: created.key,
    summary,
    description,
    status: 'To Do',
    priority: 'Medium',
    issueType,
    url: `${browseBase}/${created.key}`,
  }
}

type TransitionsResponse = {
  transitions?: Array<{ id: string; name: string; to?: { name?: string } }>
}

/** 이슈 상태 전환 (transition 이름 또는 대상 상태 이름 매칭) */
export async function transitionIssue(
  issueIdOrKey: string,
  transitionName: string,
): Promise<void> {
  const target = transitionName.toLowerCase().trim()
  const data = await jiraFetch<TransitionsResponse>(`/issue/${issueIdOrKey}/transitions`)
  const match = (data.transitions ?? []).find(t => {
    const name = t.name.toLowerCase()
    const toName = (t.to?.name ?? '').toLowerCase()
    return name === target || toName === target || name.includes(target) || toName.includes(target)
  })

  if (!match) {
    throw new Error(`전환 가능한 transition을 찾지 못했습니다: ${transitionName}`)
  }

  await jiraFetch(`/issue/${issueIdOrKey}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: match.id } }),
  })
}
