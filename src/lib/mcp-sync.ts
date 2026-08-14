/**
 * MCP (.folio-mcp) → Folio UI(localStorage) 병합
 */
import type { DocEntry } from '@/lib/docs'
import type { Task } from '@/lib/board'
import { loadJournals, saveJournal } from '@/lib/journal'
import { loadDocs, saveDoc } from '@/lib/docs'
import { loadTasks, saveTasks } from '@/lib/board'
import { flushLocalJson } from '@/lib/local-cache'

export type McpStorePayload = {
  journals: Record<
    string,
    { date: string; content: string; tags?: string[]; updatedAt?: string; id?: string }
  >
  docs: Array<{
    id: string
    title: string
    content: string
    category?: string
    createdAt?: string
    updatedAt?: string
  }>
  boards: Array<{
    id: string
    title: string
    description?: string
    status?: Task['status']
    priority?: Task['priority']
    tags?: string[]
    createdAt?: string
    updatedAt?: string
  }>
}

export type McpSyncResult = {
  journalsMerged: number
  docsUpserted: number
  tasksUpserted: number
}

function mergeJournalContent(local: string, remote: string): string {
  const a = local.trim()
  const b = remote.trim()
  if (!b) return a
  if (!a) return b
  if (a.includes(b)) return a
  if (b.includes(a)) return b
  return `${a}\n\n<!-- mcp-sync -->\n${b}`
}

/** 서버에서 받은 MCP 스토어를 브라우저 로컬 저장소에 병합 */
export function applyMcpStoreToLocal(payload: McpStorePayload): McpSyncResult {
  let journalsMerged = 0
  let docsUpserted = 0
  let tasksUpserted = 0

  const localJournals = loadJournals()
  for (const [date, entry] of Object.entries(payload.journals ?? {})) {
    if (!date || !entry) continue
    const prev = localJournals[date]
    const content = mergeJournalContent(prev?.content ?? '', entry.content ?? '')
    const tags = Array.from(new Set([...(prev?.tags ?? []), ...(entry.tags ?? [])]))
    if (content !== (prev?.content ?? '') || tags.join() !== (prev?.tags ?? []).join()) {
      saveJournal(date, content, tags)
      journalsMerged += 1
    }
  }

  const localDocs = loadDocs()
  for (const doc of payload.docs ?? []) {
    if (!doc?.id && !doc?.title) continue
    const now = new Date().toISOString()
    const existing =
      localDocs.find((d) => d.id === doc.id) ||
      localDocs.find((d) => d.title === doc.title)
    const next: DocEntry = {
      ...existing,
      id: doc.id || existing?.id || crypto.randomUUID(),
      title: doc.title,
      content: doc.content ?? '',
      category: doc.category || existing?.category || 'Dev Guide',
      createdAt: doc.createdAt || existing?.createdAt || now,
      updatedAt: doc.updatedAt || now,
    }
    const changed =
      !existing ||
      existing.content !== next.content ||
      existing.title !== next.title ||
      existing.category !== next.category
    if (changed) {
      saveDoc(next)
      docsUpserted += 1
    }
  }
  if (docsUpserted > 0) flushLocalJson('workspace_docs')

  const tasks = loadTasks()
  const byId = new Map(tasks.map((t) => [t.id, t]))
  for (const t of payload.boards ?? []) {
    if (!t?.id && !t?.title) continue
    const now = new Date().toISOString()
    const id = t.id || crypto.randomUUID()
    const prev = byId.get(id)
    const next: Task = {
      id,
      title: t.title,
      description: t.description ?? prev?.description ?? '',
      status: t.status ?? prev?.status ?? 'backlog',
      priority: t.priority ?? prev?.priority ?? 'medium',
      tags: t.tags ?? prev?.tags ?? [],
      createdAt: t.createdAt || prev?.createdAt || now,
      updatedAt: t.updatedAt || now,
    }
    byId.set(id, next)
    tasksUpserted += 1
  }
  if (tasksUpserted > 0) {
    saveTasks([...byId.values()])
  }

  flushLocalJson('workspace_journals')
  flushLocalJson('workspace_docs')
  flushLocalJson('workspace_tasks')

  return { journalsMerged, docsUpserted, tasksUpserted }
}

export async function fetchAndApplyMcpStore(): Promise<McpSyncResult & { ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/mcp/store', { cache: 'no-store' })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      return {
        ok: false,
        error: body.error || `HTTP ${res.status}`,
        journalsMerged: 0,
        docsUpserted: 0,
        tasksUpserted: 0,
      }
    }
    const data = (await res.json()) as McpStorePayload
    const result = applyMcpStoreToLocal(data)
    return { ok: true, ...result }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'sync_failed',
      journalsMerged: 0,
      docsUpserted: 0,
      tasksUpserted: 0,
    }
  }
}
