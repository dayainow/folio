/**
 * Git 커밋 → Folio Timeline / Journal / Board 연동
 */
import { appendFolioTimelineEvent } from '@/lib/beacon-sync'
import { defaultBeaconRoot } from '@/lib/beacon'
import {
  loadJournals,
  loadTasks,
  newId,
  saveJournals,
  saveTasks,
  todayDate,
  type TaskRecord,
} from '@/mcp/store'

export type GitCommitPayload = {
  id?: string
  message: string
  author?: string
  url?: string
  branch?: string
  repository?: string
}

const STATUS_FROM_PREFIX: Record<string, TaskRecord['status']> = {
  feat: 'in_progress',
  fix: 'in_progress',
  docs: 'review',
  chore: 'backlog',
  refactor: 'in_progress',
  test: 'review',
}

export async function applyGitCommitToFolio(commit: GitCommitPayload): Promise<{
  timeline: boolean
  journalDate: string
  boardTaskId?: string
}> {
  const message = commit.message.trim()
  const short = message.split('\n')[0]?.slice(0, 200) || 'commit'
  const detail = [
    commit.author ? `author: ${commit.author}` : null,
    commit.branch ? `branch: ${commit.branch}` : null,
    commit.repository ? `repo: ${commit.repository}` : null,
    commit.id ? `sha: ${commit.id.slice(0, 12)}` : null,
    commit.url ? `url: ${commit.url}` : null,
    '',
    message,
  ]
    .filter((x) => x != null)
    .join('\n')

  let timeline = false
  try {
    const event = await appendFolioTimelineEvent(
      {
        title: `Git · ${short}`,
        detail,
        category: 'git',
        type: 'git_commit',
        source: 'mcp',
      },
      defaultBeaconRoot(),
    )
    timeline = Boolean(event)
  } catch {
    timeline = false
  }

  const date = todayDate()
  const journals = await loadJournals()
  const prev = journals[date]
  const line = `- [git] ${short}${commit.id ? ` (${commit.id.slice(0, 7)})` : ''}`
  const nextContent = prev?.content?.trim()
    ? `${prev.content.replace(/\s*$/, '')}\n${line}`
    : `# ${date}\n\n${line}\n`
  journals[date] = {
    date,
    content: nextContent,
    tags: Array.from(new Set([...(prev?.tags ?? []), 'git'])),
    updatedAt: new Date().toISOString(),
    id: prev?.id,
  }
  await saveJournals(journals)

  let boardTaskId: string | undefined
  const conventional = message.match(/^(\w+)(?:\(.+\))?!?:\s*(.+)$/)
  if (conventional) {
    const [, type, rest] = conventional
    const status = STATUS_FROM_PREFIX[type ?? ''] ?? 'backlog'
    const tasks = await loadTasks()
    const now = new Date().toISOString()
    const task: TaskRecord = {
      id: newId(),
      title: (rest ?? short).slice(0, 120),
      description: detail,
      status,
      priority: type === 'fix' ? 'high' : 'medium',
      tags: ['git', type ?? 'commit'],
      createdAt: now,
      updatedAt: now,
    }
    tasks.unshift(task)
    await saveTasks(tasks)
    boardTaskId = task.id
  }

  return { timeline, journalDate: date, boardTaskId }
}
