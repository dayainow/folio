'use client'

import { requireAuthUser } from '@/lib/supabase'
import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache'
import { loadWithFallback, saveWithFallback } from '@/lib/storage'
import { cachedQuery, invalidateQueryCache } from '@/lib/query-cache'

export type ProjectStatus = 'planned' | 'active' | 'on_hold' | 'completed'

export interface WorkProject {
  id: string
  name: string
  description: string
  status: ProjectStatus
  color: string
  startDate: string | null
  dueDate: string | null
  journalKeys: string[]
  docIds: string[]
  taskIds: string[]
  createdAt: string
  updatedAt: string
}

type ProjectRow = {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  color: string
  start_date: string | null
  due_date: string | null
  journal_keys: string[] | null
  doc_ids: string[] | null
  task_ids: string[] | null
  created_at: string
  updated_at: string
}

const STORAGE_KEY = 'workspace_projects'
const SUPABASE_CACHE_KEY = 'supabase:projects'

export const PROJECT_COLORS = ['teal', 'blue', 'violet', 'amber', 'rose', 'slate'] as const

export function loadProjects(): WorkProject[] {
  return getLocalJson<WorkProject[]>(STORAGE_KEY, [])
}

export function saveProjects(projects: WorkProject[]): void {
  setLocalJson(STORAGE_KEY, projects)
  flushLocalJson(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent('folio-projects-changed'))
}

function rowToProject(row: ProjectRow): WorkProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    status: row.status,
    color: row.color || 'teal',
    startDate: row.start_date,
    dueDate: row.due_date,
    journalKeys: row.journal_keys ?? [],
    docIds: row.doc_ids ?? [],
    taskIds: row.task_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function projectToRow(project: WorkProject, userId: string) {
  return {
    id: project.id,
    user_id: userId,
    name: project.name,
    description: project.description,
    status: project.status,
    color: project.color,
    start_date: project.startDate,
    due_date: project.dueDate,
    journal_keys: project.journalKeys,
    doc_ids: project.docIds,
    task_ids: project.taskIds,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  }
}

export async function loadProjectsSupabase(): Promise<WorkProject[]> {
  return cachedQuery(SUPABASE_CACHE_KEY, async () => {
    const { supabase, userId } = await requireAuthUser()
    const { data, error } = await supabase
      .from('projects')
      .select(
        'id, name, description, status, color, start_date, due_date, journal_keys, doc_ids, task_ids, created_at, updated_at',
      )
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as ProjectRow[]).map(rowToProject)
  })
}

export async function saveProjectsSupabase(projects: WorkProject[]): Promise<void> {
  if (projects.length === 0) return
  const { supabase, userId } = await requireAuthUser()
  const { error } = await supabase
    .from('projects')
    .upsert(projects.map((project) => projectToRow(project, userId)), { onConflict: 'id' })
  if (error) throw error
  invalidateQueryCache(SUPABASE_CACHE_KEY)
}

export async function deleteProjectSupabase(id: string): Promise<void> {
  const { supabase, userId } = await requireAuthUser()
  const { error } = await supabase.from('projects').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
  invalidateQueryCache(SUPABASE_CACHE_KEY)
}

export async function saveProjectsWithFallback(projects: WorkProject[]) {
  return saveWithFallback(projects, 'projects', {
    localSave: () => saveProjects(projects),
    cloudSave: async () => saveProjectsSupabase(projects),
  })
}

export async function deleteProjectWithFallback(id: string) {
  const next = loadProjects().filter((project) => project.id !== id)
  const result = await saveWithFallback(next, 'projects', {
    localSave: () => saveProjects(next),
    cloudSave: async () => deleteProjectSupabase(id),
  })
  if (result.usedFallback) {
    const { queueRemoteSync } = await import('@/lib/offline-sync')
    await queueRemoteSync('projects', { operation: 'delete', id }, 'project delete')
  }
  return result
}

export async function loadProjectsWithFallback(): Promise<WorkProject[]> {
  return loadWithFallback({
    type: 'projects',
    localLoad: loadProjects,
    cloudLoad: loadProjectsSupabase,
    emptyBeacon: [],
  })
}

export function createProject(input: {
  name: string
  description?: string
  status?: ProjectStatus
  color?: string
  startDate?: string | null
  dueDate?: string | null
}): WorkProject {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: input.name.trim() || '새 프로젝트',
    description: input.description?.trim() ?? '',
    status: input.status ?? 'active',
    color: input.color ?? 'teal',
    startDate: input.startDate ?? null,
    dueDate: input.dueDate ?? null,
    journalKeys: [],
    docIds: [],
    taskIds: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function toggleProjectLink(
  project: WorkProject,
  kind: 'journal' | 'doc' | 'task',
  targetId: string,
): WorkProject {
  const field = kind === 'journal' ? 'journalKeys' : kind === 'doc' ? 'docIds' : 'taskIds'
  const current = project[field]
  const next = current.includes(targetId)
    ? current.filter((id) => id !== targetId)
    : [...current, targetId]
  return { ...project, [field]: next, updatedAt: new Date().toISOString() }
}
