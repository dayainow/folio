/**
 * P54 — 데이터 마이그레이션 실행기 · 검증 · SQLite/JSON 입출력 · 충돌 해결
 */
'use client'

import { loadJournals } from '@/lib/journal'
import type { JournalEntry } from '@/lib/journal'
import { loadDocs } from '@/lib/docs'
import type { DocEntry } from '@/lib/docs'
import { loadTasks } from '@/lib/board'
import type { Task } from '@/lib/board'
import { setLocalJson, flushLocalJson } from '@/lib/local-cache'
import { checksumData } from '@/lib/storage-integrity'
import { downloadBlob } from '@/lib/export'
import {
  LATEST_SCHEMA_VERSION,
  migrationsBetween,
} from '@/migrations'
import type {
  ConflictStrategy,
  FolioDataset,
  MigrationLogEntry,
  MigrationProgress,
  ValidationReport,
} from '@/migrations/types'

export type {
  ConflictStrategy,
  FolioDataset,
  MigrationLogEntry,
  MigrationProgress,
  ValidationReport,
} from '@/migrations/types'

export { LATEST_SCHEMA_VERSION, MIGRATIONS } from '@/migrations'

const SCHEMA_KEY = 'folio_schema_version'
const LOG_KEY = 'folio_migration_log'
const SNAPSHOT_KEY = 'folio_migration_last_snapshot'
const JOURNALS_KEY = 'workspace_journals'
const DOCS_KEY = 'workspace_docs'
const TASKS_KEY = 'workspace_tasks'

export type ProgressFn = (p: MigrationProgress) => void

function readSchemaVersion(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = localStorage.getItem(SCHEMA_KEY)
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

function writeSchemaVersion(v: number) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SCHEMA_KEY, String(v))
  } catch {
    /* ignore */
  }
}

export function getCurrentSchemaVersion(): number {
  return readSchemaVersion()
}

export function loadDataset(): FolioDataset {
  return {
    schemaVersion: readSchemaVersion(),
    journals: loadJournals(),
    docs: loadDocs(),
    tasks: loadTasks(),
  }
}

export function persistDataset(data: FolioDataset) {
  setLocalJson(JOURNALS_KEY, data.journals)
  flushLocalJson(JOURNALS_KEY)
  setLocalJson(DOCS_KEY, data.docs)
  flushLocalJson(DOCS_KEY)
  setLocalJson(TASKS_KEY, data.tasks)
  flushLocalJson(TASKS_KEY)
  writeSchemaVersion(data.schemaVersion)
}

export function validateDataset(data: FolioDataset): ValidationReport {
  const issues: string[] = []
  if (!data.journals || typeof data.journals !== 'object') {
    issues.push('journals 객체가 없습니다')
  }
  if (!Array.isArray(data.docs)) issues.push('docs 배열이 아닙니다')
  if (!Array.isArray(data.tasks)) issues.push('tasks 배열이 아닙니다')

  for (const [date, entry] of Object.entries(data.journals ?? {})) {
    if (!entry || typeof entry !== 'object') {
      issues.push(`journal ${date}: 잘못된 항목`)
      continue
    }
    if (!entry.date && !date) issues.push(`journal: date 누락`)
  }
  for (const doc of data.docs ?? []) {
    if (!doc?.id) issues.push('doc: id 누락')
  }
  for (const task of data.tasks ?? []) {
    if (!task?.id) issues.push('task: id 누락')
  }

  const counts = {
    journals: Object.keys(data.journals ?? {}).length,
    docs: (data.docs ?? []).length,
    tasks: (data.tasks ?? []).length,
  }
  const checksum = checksumData({
    schemaVersion: data.schemaVersion,
    journals: data.journals,
    docs: data.docs,
    tasks: data.tasks,
  })

  return {
    at: new Date().toISOString(),
    ok: issues.length === 0,
    schemaVersion: data.schemaVersion,
    counts,
    checksum,
    issues,
  }
}

function pushLog(entry: MigrationLogEntry) {
  if (typeof window === 'undefined') return
  try {
    const prev = JSON.parse(localStorage.getItem(LOG_KEY) || '[]') as MigrationLogEntry[]
    const next = [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 50)
    localStorage.setItem(LOG_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export function listMigrationLogs(): MigrationLogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const prev = JSON.parse(localStorage.getItem(LOG_KEY) || '[]') as MigrationLogEntry[]
    return Array.isArray(prev) ? prev : []
  } catch {
    return []
  }
}

export function saveSnapshot(data: FolioDataset) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        at: new Date().toISOString(),
        data,
        checksum: checksumData(data),
      }),
    )
  } catch {
    /* quota — skip */
  }
}

export function loadLastSnapshot(): FolioDataset | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data?: FolioDataset }
    return parsed.data ?? null
  } catch {
    return null
  }
}

/** targetVersion까지 up/down 실행 */
export async function runMigrationsTo(
  targetVersion: number,
  onProgress?: ProgressFn,
): Promise<{
  ok: boolean
  from: number
  to: number
  reportBefore: ValidationReport
  reportAfter: ValidationReport
  message?: string
}> {
  const from = readSchemaVersion()
  const clamped = Math.max(0, Math.min(targetVersion, LATEST_SCHEMA_VERSION))
  onProgress?.({ phase: 'validate', ratio: 0.05, label: '마이그레이션 전 검증…' })
  let data = loadDataset()
  data.schemaVersion = from
  const reportBefore = validateDataset(data)
  if (!reportBefore.ok) {
    onProgress?.({ phase: 'error', ratio: 1, label: '검증 실패' })
    return {
      ok: false,
      from,
      to: from,
      reportBefore,
      reportAfter: reportBefore,
      message: reportBefore.issues.join('; '),
    }
  }

  if (clamped === from) {
    onProgress?.({ phase: 'done', ratio: 1, label: '이미 최신입니다' })
    return {
      ok: true,
      from,
      to: from,
      reportBefore,
      reportAfter: reportBefore,
      message: '변경 없음',
    }
  }

  onProgress?.({ phase: 'snapshot', ratio: 0.15, label: '스냅샷 저장…' })
  saveSnapshot(data)

  const steps = migrationsBetween(from, clamped)
  const direction = clamped > from ? 'up' : 'down'
  const ids: number[] = []

  for (let i = 0; i < steps.length; i += 1) {
    const m = steps[i]!
    const ratio = 0.2 + (0.6 * (i + 1)) / steps.length
    onProgress?.({
      phase: 'migrate',
      ratio,
      label: `${direction === 'up' ? '적용' : '롤백'}: ${m.name} (v${m.id})`,
    })
    data = direction === 'up' ? await m.up(data) : await m.down(data)
    data.schemaVersion = direction === 'up' ? m.id : m.id - 1
    ids.push(m.id)
  }

  data.schemaVersion = clamped
  onProgress?.({ phase: 'validate', ratio: 0.9, label: '마이그레이션 후 검증…' })
  const reportAfter = validateDataset(data)
  if (!reportAfter.ok) {
    const snap = loadLastSnapshot()
    if (snap) persistDataset(snap)
    pushLog({
      at: new Date().toISOString(),
      fromVersion: from,
      toVersion: clamped,
      direction,
      migrations: ids,
      checksumBefore: reportBefore.checksum,
      checksumAfter: reportAfter.checksum,
      ok: false,
      message: reportAfter.issues.join('; '),
    })
    onProgress?.({ phase: 'error', ratio: 1, label: '검증 실패 — 스냅샷 복구' })
    return {
      ok: false,
      from,
      to: from,
      reportBefore,
      reportAfter,
      message: reportAfter.issues.join('; '),
    }
  }

  persistDataset(data)
  pushLog({
    at: new Date().toISOString(),
    fromVersion: from,
    toVersion: clamped,
    direction,
    migrations: ids,
    checksumBefore: reportBefore.checksum,
    checksumAfter: reportAfter.checksum,
    ok: true,
  })
  onProgress?.({ phase: 'done', ratio: 1, label: `완료 · v${clamped}` })
  return {
    ok: true,
    from,
    to: clamped,
    reportBefore,
    reportAfter,
  }
}

export async function migrateToLatest(onProgress?: ProgressFn) {
  return runMigrationsTo(LATEST_SCHEMA_VERSION, onProgress)
}

export async function rollbackOne(onProgress?: ProgressFn) {
  const cur = readSchemaVersion()
  if (cur <= 0) {
    onProgress?.({ phase: 'done', ratio: 1, label: '롤백할 버전 없음' })
    return runMigrationsTo(0, onProgress)
  }
  return runMigrationsTo(cur - 1, onProgress)
}

export async function rollbackToSnapshot(onProgress?: ProgressFn) {
  onProgress?.({ phase: 'snapshot', ratio: 0.2, label: '스냅샷 로드…' })
  const snap = loadLastSnapshot()
  if (!snap) {
    onProgress?.({ phase: 'error', ratio: 1, label: '스냅샷 없음' })
    return { ok: false as const, message: '저장된 스냅샷이 없습니다' }
  }
  const before = validateDataset(loadDataset())
  onProgress?.({ phase: 'migrate', ratio: 0.6, label: '스냅샷 복원…' })
  persistDataset(snap)
  const after = validateDataset(snap)
  pushLog({
    at: new Date().toISOString(),
    fromVersion: before.schemaVersion,
    toVersion: snap.schemaVersion,
    direction: 'down',
    migrations: [],
    checksumBefore: before.checksum,
    checksumAfter: after.checksum,
    ok: after.ok,
    message: 'snapshot restore',
  })
  onProgress?.({ phase: 'done', ratio: 1, label: '스냅샷 복원 완료' })
  return { ok: after.ok, message: after.ok ? undefined : after.issues.join('; ') }
}

/** JSON 내보내기 */
export function exportDatasetJson(data?: FolioDataset): Blob {
  const payload = data ?? loadDataset()
  const body = {
    format: 'folio-dataset',
    version: 1,
    exportedAt: new Date().toISOString(),
    ...payload,
    validation: validateDataset(payload),
  }
  return new Blob([`${JSON.stringify(body, null, 2)}\n`], {
    type: 'application/json;charset=utf-8',
  })
}

export function downloadDatasetJson(filename = `folio-dataset-v${readSchemaVersion()}.json`) {
  downloadBlob(exportDatasetJson(), filename)
}

async function getSqlJs() {
  const initSqlJs = (await import('sql.js')).default
  return initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`,
  })
}

/** SQLite 덤프 (sql.js) */
export async function exportDatasetSqlite(
  data?: FolioDataset,
  onProgress?: ProgressFn,
): Promise<Blob> {
  onProgress?.({ phase: 'export', ratio: 0.1, label: 'SQLite 초기화…' })
  const SQL = await getSqlJs()
  const db = new SQL.Database()
  const payload = data ?? loadDataset()

  db.run(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE journals (
      date TEXT PRIMARY KEY,
      id TEXT,
      content TEXT,
      tags TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE docs (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      category TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      status TEXT,
      priority TEXT,
      tags TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `)

  db.run('INSERT INTO meta VALUES (?, ?)', ['schemaVersion', String(payload.schemaVersion)])
  db.run('INSERT INTO meta VALUES (?, ?)', ['exportedAt', new Date().toISOString()])
  db.run('INSERT INTO meta VALUES (?, ?)', ['checksum', checksumData(payload)])

  onProgress?.({ phase: 'export', ratio: 0.4, label: '일지 기록…' })
  const jStmt = db.prepare(
    'INSERT INTO journals VALUES (?, ?, ?, ?, ?, ?)',
  )
  for (const [date, e] of Object.entries(payload.journals)) {
    jStmt.run([
      date,
      e.id ?? null,
      e.content ?? '',
      JSON.stringify(e.tags ?? []),
      e.createdAt ?? null,
      e.updatedAt ?? null,
    ])
  }
  jStmt.free()

  onProgress?.({ phase: 'export', ratio: 0.65, label: '문서 기록…' })
  const dStmt = db.prepare(
    'INSERT INTO docs VALUES (?, ?, ?, ?, ?, ?)',
  )
  for (const d of payload.docs) {
    dStmt.run([d.id, d.title, d.content, d.category, d.createdAt, d.updatedAt])
  }
  dStmt.free()

  onProgress?.({ phase: 'export', ratio: 0.85, label: '태스크 기록…' })
  const tStmt = db.prepare(
    'INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
  for (const t of payload.tasks) {
    tStmt.run([
      t.id,
      t.title,
      t.description,
      t.status,
      t.priority,
      JSON.stringify(t.tags ?? []),
      t.createdAt,
      t.updatedAt,
    ])
  }
  tStmt.free()

  const bytes = db.export()
  db.close()
  onProgress?.({ phase: 'done', ratio: 1, label: 'SQLite 덤프 완료' })
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy], { type: 'application/x-sqlite3' })
}

export async function downloadDatasetSqlite(
  filename = `folio-dump-v${readSchemaVersion()}.sqlite`,
  onProgress?: ProgressFn,
) {
  const blob = await exportDatasetSqlite(undefined, onProgress)
  downloadBlob(blob, filename)
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return Array.isArray(p) ? p.map(String) : []
    } catch {
      return raw ? [raw] : []
    }
  }
  return []
}

export async function importDatasetSqlite(buffer: ArrayBuffer): Promise<FolioDataset> {
  const SQL = await getSqlJs()
  const db = new SQL.Database(new Uint8Array(buffer))
  let schemaVersion = 0
  try {
    const meta = db.exec('SELECT value FROM meta WHERE key = "schemaVersion"')
    if (meta[0]?.values?.[0]?.[0] != null) {
      schemaVersion = Number(meta[0].values[0][0]) || 0
    }
  } catch {
    schemaVersion = 0
  }

  const journals: Record<string, JournalEntry> = {}
  try {
    const rows = db.exec('SELECT date, id, content, tags, created_at, updated_at FROM journals')
    for (const row of rows[0]?.values ?? []) {
      const date = String(row[0])
      journals[date] = {
        id: row[1] != null ? String(row[1]) : undefined,
        date,
        content: String(row[2] ?? ''),
        tags: parseTags(row[3]),
        createdAt: row[4] != null ? String(row[4]) : undefined,
        updatedAt: String(row[5] ?? new Date().toISOString()),
      }
    }
  } catch {
    /* empty */
  }

  const docs: DocEntry[] = []
  try {
    const rows = db.exec(
      'SELECT id, title, content, category, created_at, updated_at FROM docs',
    )
    for (const row of rows[0]?.values ?? []) {
      docs.push({
        id: String(row[0]),
        title: String(row[1] ?? ''),
        content: String(row[2] ?? ''),
        category: String(row[3] ?? 'General'),
        createdAt: String(row[4] ?? new Date().toISOString()),
        updatedAt: String(row[5] ?? new Date().toISOString()),
      })
    }
  } catch {
    /* empty */
  }

  const tasks: Task[] = []
  try {
    const rows = db.exec(
      'SELECT id, title, description, status, priority, tags, created_at, updated_at FROM tasks',
    )
    for (const row of rows[0]?.values ?? []) {
      const status = String(row[3] ?? 'backlog') as Task['status']
      const priority = String(row[4] ?? 'medium') as Task['priority']
      tasks.push({
        id: String(row[0]),
        title: String(row[1] ?? ''),
        description: String(row[2] ?? ''),
        status: ['backlog', 'in_progress', 'review', 'done'].includes(status)
          ? status
          : 'backlog',
        priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
        tags: parseTags(row[5]),
        createdAt: String(row[6] ?? new Date().toISOString()),
        updatedAt: String(row[7] ?? new Date().toISOString()),
      })
    }
  } catch {
    /* empty */
  }

  db.close()
  return { schemaVersion, journals, docs, tasks }
}

export function parseDatasetJson(text: string): FolioDataset {
  const parsed = JSON.parse(text) as Partial<FolioDataset> & {
    format?: string
  }
  return {
    schemaVersion: Number(parsed.schemaVersion) || 0,
    journals: (parsed.journals as Record<string, JournalEntry>) ?? {},
    docs: Array.isArray(parsed.docs) ? (parsed.docs as DocEntry[]) : [],
    tasks: Array.isArray(parsed.tasks) ? (parsed.tasks as Task[]) : [],
  }
}

export function mergeDatasets(
  current: FolioDataset,
  incoming: FolioDataset,
  strategy: ConflictStrategy,
): FolioDataset {
  if (strategy === 'overwrite') {
    return {
      schemaVersion: Math.max(current.schemaVersion, incoming.schemaVersion),
      journals: { ...incoming.journals },
      docs: [...incoming.docs],
      tasks: [...incoming.tasks],
    }
  }

  if (strategy === 'skip') {
    const journals = { ...current.journals }
    for (const [date, entry] of Object.entries(incoming.journals)) {
      if (!(date in journals)) journals[date] = entry
    }
    const docIds = new Set(current.docs.map((d) => d.id))
    const docs = [
      ...current.docs,
      ...incoming.docs.filter((d) => !docIds.has(d.id)),
    ]
    const taskIds = new Set(current.tasks.map((t) => t.id))
    const tasks = [
      ...current.tasks,
      ...incoming.tasks.filter((t) => !taskIds.has(t.id)),
    ]
    return {
      schemaVersion: Math.max(current.schemaVersion, incoming.schemaVersion),
      journals,
      docs,
      tasks,
    }
  }

  // merge — 같은 키면 incoming이 더 최신이면 교체
  const journals = { ...current.journals }
  for (const [date, entry] of Object.entries(incoming.journals)) {
    const cur = journals[date]
    if (!cur || (entry.updatedAt || '') >= (cur.updatedAt || '')) {
      journals[date] = entry
    }
  }
  const docMap = new Map(current.docs.map((d) => [d.id, d]))
  for (const d of incoming.docs) {
    const cur = docMap.get(d.id)
    if (!cur || (d.updatedAt || '') >= (cur.updatedAt || '')) {
      docMap.set(d.id, d)
    }
  }
  const taskMap = new Map(current.tasks.map((t) => [t.id, t]))
  for (const t of incoming.tasks) {
    const cur = taskMap.get(t.id)
    if (!cur || (t.updatedAt || '') >= (cur.updatedAt || '')) {
      taskMap.set(t.id, t)
    }
  }
  return {
    schemaVersion: Math.max(current.schemaVersion, incoming.schemaVersion),
    journals,
    docs: [...docMap.values()],
    tasks: [...taskMap.values()],
  }
}

export async function importAndApply(
  incoming: FolioDataset,
  strategy: ConflictStrategy,
  onProgress?: ProgressFn,
): Promise<{
  ok: boolean
  reportBefore: ValidationReport
  reportAfter: ValidationReport
  message?: string
}> {
  onProgress?.({ phase: 'validate', ratio: 0.1, label: '가져오기 검증…' })
  const incomingReport = validateDataset(incoming)
  if (!incomingReport.ok) {
    onProgress?.({ phase: 'error', ratio: 1, label: '가져오기 데이터 오류' })
    return {
      ok: false,
      reportBefore: incomingReport,
      reportAfter: incomingReport,
      message: incomingReport.issues.join('; '),
    }
  }

  const current = loadDataset()
  const reportBefore = validateDataset(current)
  onProgress?.({ phase: 'snapshot', ratio: 0.25, label: '스냅샷…' })
  saveSnapshot(current)

  onProgress?.({ phase: 'import', ratio: 0.5, label: `충돌 전략: ${strategy}` })
  let merged = mergeDatasets(current, incoming, strategy)

  onProgress?.({ phase: 'migrate', ratio: 0.7, label: '점진적 스키마 마이그레이션…' })
  if (merged.schemaVersion < LATEST_SCHEMA_VERSION) {
    const steps = migrationsBetween(merged.schemaVersion, LATEST_SCHEMA_VERSION)
    for (const m of steps) {
      merged = await m.up(merged)
      merged.schemaVersion = m.id
    }
  }

  onProgress?.({ phase: 'validate', ratio: 0.9, label: '결과 검증…' })
  const reportAfter = validateDataset(merged)
  if (!reportAfter.ok) {
    onProgress?.({ phase: 'error', ratio: 1, label: '검증 실패' })
    return {
      ok: false,
      reportBefore,
      reportAfter,
      message: reportAfter.issues.join('; '),
    }
  }

  persistDataset(merged)
  pushLog({
    at: new Date().toISOString(),
    fromVersion: reportBefore.schemaVersion,
    toVersion: merged.schemaVersion,
    direction: 'up',
    migrations: [],
    checksumBefore: reportBefore.checksum,
    checksumAfter: reportAfter.checksum,
    ok: true,
    message: `import:${strategy}`,
  })
  onProgress?.({ phase: 'done', ratio: 1, label: '가져오기 완료' })
  return { ok: true, reportBefore, reportAfter }
}

export function buildMigrationReport(opts: {
  before: ValidationReport
  after: ValidationReport
  from: number
  to: number
  ok: boolean
  message?: string
}): string {
  const lines = [
    '# Folio Migration Report',
    '',
    `- At: ${new Date().toISOString()}`,
    `- Result: ${opts.ok ? 'OK' : 'FAIL'}`,
    `- Version: ${opts.from} → ${opts.to}`,
    opts.message ? `- Message: ${opts.message}` : '',
    '',
    '## Before',
    `- checksum: ${opts.before.checksum}`,
    `- journals: ${opts.before.counts.journals}`,
    `- docs: ${opts.before.counts.docs}`,
    `- tasks: ${opts.before.counts.tasks}`,
    '',
    '## After',
    `- checksum: ${opts.after.checksum}`,
    `- journals: ${opts.after.counts.journals}`,
    `- docs: ${opts.after.counts.docs}`,
    `- tasks: ${opts.after.counts.tasks}`,
    '',
  ].filter(Boolean)
  if (opts.after.issues.length) {
    lines.push('## Issues', ...opts.after.issues.map((i) => `- ${i}`), '')
  }
  return `${lines.join('\n')}\n`
}

export function downloadMigrationReport(report: string) {
  downloadBlob(
    new Blob([report], { type: 'text/markdown;charset=utf-8' }),
    `folio-migration-report-${Date.now()}.md`,
  )
}

/** 테스트용 */
export function __resetMigrationStateForTests() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SCHEMA_KEY)
  localStorage.removeItem(LOG_KEY)
  localStorage.removeItem(SNAPSHOT_KEY)
}
