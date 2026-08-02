/**
 * P39 — 워크플로우 이벤트 핸들러
 * 저장 / Jira / Beacon Gate / GitHub PR 등 이벤트를 Slack·Discord·Board에 연결
 */

export type WorkflowEventKind =
  | 'save'
  | 'task_done'
  | 'gate_change'
  | 'jira_sync'
  | 'github_pr_merged'
  | 'github_issue_updated'
  | 'info'
  | 'warning'

export type WorkflowEvent = {
  kind: WorkflowEventKind
  title: string
  message: string
  /** Folio 딥링크 경로 또는 절대 URL */
  actionUrl?: string
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  /** Board 동기화용 Jira 키 */
  jiraKey?: string
  /** Gate 이름/진행률 */
  gate?: { name: string; progressPercent?: number; status?: string }
  /** GitHub */
  github?: {
    issueNumber?: number
    prNumber?: number
    state?: string
    url?: string
  }
  notify?: boolean
}

export type WorkflowResult = {
  ok: boolean
  discord?: { ok: boolean; skipped?: boolean }
  slack?: { ok: boolean; skipped?: boolean }
  board?: { moved?: number; synced?: number; details?: string }
  processRefresh?: boolean
}

function folioUrl(path = '/'): string {
  const base =
    process.env.NEXT_PUBLIC_FOLIO_URL?.replace(/\/$/, '') ||
    process.env.FOLIO_PUBLIC_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
  if (path.startsWith('http')) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function discordKind(
  kind: WorkflowEventKind,
): 'save' | 'task_done' | 'gate' | 'info' | 'warning' {
  if (kind === 'save') return 'save'
  if (kind === 'task_done' || kind === 'github_pr_merged') return 'task_done'
  if (kind === 'gate_change') return 'gate'
  if (kind === 'warning') return 'warning'
  return 'info'
}

/** 저장 → Discord/Slack 알림 */
export async function onSaveEvent(input: {
  title: string
  message: string
  actionUrl?: string
}): Promise<WorkflowResult> {
  return dispatchWorkflowEvent({
    kind: 'save',
    title: input.title,
    message: input.message,
    actionUrl: input.actionUrl ?? '/?tab=journal',
    notify: true,
  })
}

/** Jira 이슈 업데이트 → Board 동기화 힌트 + 알림 */
export async function onJiraIssueUpdated(input: {
  jiraKey: string
  summary: string
  status?: string
}): Promise<WorkflowResult> {
  return dispatchWorkflowEvent({
    kind: 'jira_sync',
    title: `Jira ${input.jiraKey}`,
    message: input.summary,
    jiraKey: input.jiraKey,
    fields: input.status
      ? [{ name: 'Status', value: input.status, inline: true }]
      : undefined,
    actionUrl: '/?tab=board',
    notify: true,
  })
}

/** Beacon Gate 변경 → 프로세스 탭 갱신 플래그 + 알림 */
export async function onBeaconGateChange(input: {
  name: string
  progressPercent?: number
  status?: string
  message?: string
}): Promise<WorkflowResult> {
  return dispatchWorkflowEvent({
    kind: 'gate_change',
    title: `Gate · ${input.name}`,
    message: input.message ?? `Gate 상태가 변경되었습니다 (${input.status ?? 'updated'})`,
    gate: {
      name: input.name,
      progressPercent: input.progressPercent,
      status: input.status,
    },
    fields: [
      ...(input.status
        ? [{ name: 'Status', value: input.status, inline: true }]
        : []),
      ...(typeof input.progressPercent === 'number'
        ? [{ name: 'Progress', value: `${input.progressPercent}%`, inline: true }]
        : []),
    ],
    actionUrl: '/?tab=process',
    notify: true,
  })
}

/** GitHub PR 머지 → Board Done + 알림 */
export async function onGitHubPrMerged(input: {
  prNumber: number
  title: string
  url?: string
  closingIssues?: number[]
}): Promise<WorkflowResult> {
  const { fetchPullRequest, applyMergedPrToBoard } = await import('@/lib/github')
  let movedCount = 0
  let details = ''

  const pr = await fetchPullRequest(input.prNumber)
  if (pr?.merged) {
    const result = await applyMergedPrToBoard(pr)
    movedCount = result.moved.length
    details = result.moved.map((m) => m.title).join(', ')
  } else if (input.closingIssues?.length) {
    const synthetic = {
      id: 0,
      number: input.prNumber,
      title: input.title,
      state: 'closed',
      merged: true,
      htmlUrl: input.url ?? '',
      body: input.closingIssues.map((n) => `closes #${n}`).join(' '),
      closingIssues: input.closingIssues,
    }
    const result = await applyMergedPrToBoard(synthetic)
    movedCount = result.moved.length
    details = result.moved.map((m) => m.title).join(', ')
  }

  return dispatchWorkflowEvent({
    kind: 'github_pr_merged',
    title: `PR #${input.prNumber} merged`,
    message: input.title,
    github: {
      prNumber: input.prNumber,
      url: input.url,
      state: 'merged',
    },
    fields: [
      ...(movedCount
        ? [{ name: 'Board', value: `${movedCount}건 Done 이동`, inline: true }]
        : [{ name: 'Board', value: '매칭 태스크 없음', inline: true }]),
      ...(details ? [{ name: 'Tasks', value: details.slice(0, 200) }] : []),
    ],
    actionUrl: '/?tab=board',
    notify: true,
  }).then((r) => ({
    ...r,
    board: { moved: movedCount, details: details || undefined },
  }))
}

/** 통합 디스패치 */
export async function dispatchWorkflowEvent(event: WorkflowEvent): Promise<WorkflowResult> {
  const result: WorkflowResult = { ok: true }
  const shouldNotify = event.notify !== false
  const action = event.actionUrl ? folioUrl(event.actionUrl) : folioUrl('/')

  if (shouldNotify) {
    const [{ sendDiscordEvent, isDiscordConfigured }, { sendSlackNotification, isSlackConfigured }] =
      await Promise.all([import('@/lib/discord'), import('@/lib/slack')])

    if (isDiscordConfigured()) {
      try {
        result.discord = await sendDiscordEvent(
          discordKind(event.kind),
          event.title,
          event.message,
          event.fields,
        )
      } catch (err) {
        result.discord = { ok: false }
        result.ok = false
        void err
      }
    } else {
      result.discord = { ok: true, skipped: true }
    }

    if (isSlackConfigured()) {
      try {
        const fieldLines = (event.fields ?? [])
          .map((f) => `• *${f.name}*: ${f.value}`)
          .join('\n')
        result.slack = await sendSlackNotification({
          text: event.title,
          body: `${event.message}${fieldLines ? `\n${fieldLines}` : ''}`,
          actions: [{ text: 'Folio에서 보기', url: action }],
        })
      } catch (err) {
        result.slack = { ok: false }
        result.ok = false
        void err
      }
    } else {
      result.slack = { ok: true, skipped: true }
    }
  }

  if (event.kind === 'gate_change') {
    result.processRefresh = true
  }

  if (event.kind === 'jira_sync' && event.jiraKey) {
    // Board UI가 Jira 동기화 버튼으로 갱신 — 서버는 알림 + 힌트만
    result.board = { synced: 0, details: `jira:${event.jiraKey}` }
  }

  return result
}
