/**
 * Folio MCP 서버용 파일 스토어 (Node 전용)
 * 우선순위: .folio-mcp/ → .beacon/cache/folio-*.json
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type JournalMap = Record<
  string,
  { date: string; content: string; tags: string[]; updatedAt: string; id?: string }
>

export type DocRecord = {
  id: string
  title: string
  content: string
  category: string
  createdAt: string
  updatedAt: string
}

export type TaskRecord = {
  id: string
  title: string
  description: string
  status: 'backlog' | 'in_progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high'
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type StoreKind = 'journals' | 'docs' | 'boards'

function projectRoot(): string {
  return process.env.FOLIO_MCP_ROOT || process.env.BEACON_PROJECT_ROOT || process.cwd()
}

function dataDir(root = projectRoot()): string {
  return process.env.FOLIO_MCP_DATA_DIR || path.join(root, '.folio-mcp')
}

function primaryPath(kind: StoreKind, root = projectRoot()): string {
  return path.join(dataDir(root), `${kind}.json`)
}

function beaconCachePath(kind: StoreKind, root = projectRoot()): string {
  return path.join(root, '.beacon', 'cache', `folio-${kind}.json`)
}

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(file, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJsonFile(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

/** journals / docs / boards 로드 */
export async function loadStore<T>(kind: StoreKind, fallback: T): Promise<T> {
  const root = projectRoot()
  const primary = await readJsonFile<T | null>(primaryPath(kind, root), null)
  if (primary != null) return primary
  return readJsonFile<T>(beaconCachePath(kind, root), fallback)
}

export async function saveStore(kind: StoreKind, data: unknown): Promise<string> {
  const root = projectRoot()
  const file = primaryPath(kind, root)
  await writeJsonFile(file, data)
  // Beacon 캐시가 있으면 동기화 (없어도 무시)
  try {
    await writeJsonFile(beaconCachePath(kind, root), data)
  } catch {
    /* beacon 미초기화 */
  }
  return file
}

export async function loadJournals(): Promise<JournalMap> {
  return loadStore<JournalMap>('journals', {})
}

export async function saveJournals(data: JournalMap): Promise<string> {
  return saveStore('journals', data)
}

export async function loadDocs(): Promise<DocRecord[]> {
  const raw = await loadStore<DocRecord[] | { docs?: DocRecord[] }>('docs', [])
  return Array.isArray(raw) ? raw : (raw.docs ?? [])
}

export async function saveDocs(docs: DocRecord[]): Promise<string> {
  return saveStore('docs', docs)
}

export async function loadTasks(): Promise<TaskRecord[]> {
  const raw = await loadStore<TaskRecord[] | { tasks?: TaskRecord[] }>('boards', [])
  return Array.isArray(raw) ? raw : (raw.tasks ?? [])
}

export async function saveTasks(tasks: TaskRecord[]): Promise<string> {
  return saveStore('boards', tasks)
}

export function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function newId(): string {
  return crypto.randomUUID()
}

export { projectRoot, dataDir }
