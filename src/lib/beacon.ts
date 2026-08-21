import { csrfHeaders } from '@/lib/csrf'
/**
 * Beacon 프로세스 상태 읽기 + Folio 오버레이(P23)
 * - 서버: BEACON_PROJECT_ROOT 또는 process.cwd() 아래 `.beacon/`
 * - 클라이언트: File System Access API 또는 `/api/beacon/*`
 */

export type ProcessStageId = 'p0' | 'p1' | 'p2' | 'p3' | 'p4'
export type GateStatus = 'ready' | 'needs_evidence' | 'unknown'
export type StageState = 'ready' | 'current' | 'upcoming' | 'unknown'

export interface FolioGateOverlay {
  status: GateStatus
  state?: StageState
}

export interface FolioArtifactOverlay {
  path: string
  name: string
  kind: string
  category?: string
  present: boolean
  source?: 'folio' | 'beacon'
  docId?: string
  modifiedAt?: string
}

export interface FolioProjectEdit {
  at: string
  op: string
  stageId?: ProcessStageId
  detail?: string
}

export interface FolioProjectOverlay {
  updatedAt: string
  baseVersion: number
  baseMtime: number | null
  name?: string
  gates?: Partial<Record<ProcessStageId, FolioGateOverlay>>
  artifacts?: FolioArtifactOverlay[]
  edits: FolioProjectEdit[]
}

export interface BeaconProjectJson {
  version: number
  initializedAt: string
  name?: string
  /** Folio append-only 오버레이 (CLI 원본 필드와 공존) */
  folio?: FolioProjectOverlay
}

export interface StageSummary {
  id: ProcessStageId
  name: string
  objective: string
  state: StageState
  gateStatus: GateStatus
  satisfiedRequirements: number
  totalRequirements: number
}

export interface ProjectSummary {
  name: string
  initializedAt: string | null
  currentGate: ProcessStageId | null
  currentGateLabel: string | null
  progressPercent: number
  readyStages: number
  totalStages: number
  stages: StageSummary[]
  scannedAt: string | null
}

export interface TimelineItem {
  id: string
  title: string
  detail: string
  occurredAt: string
  category?: string
  type?: string
  source?: string
}

export interface ArtifactItem {
  path: string
  name: string
  kind: string
  scope?: string
  modifiedAt?: string
  present: boolean
}

export interface BeaconDbPayload {
  timeline: TimelineItem[]
  latestSnapshot: BeaconSnapshotLike | null
  snapshotCount: number
}

export interface BeaconSnapshotLike {
  scannedAt?: string
  process?: {
    currentStageId?: ProcessStageId | null
    readyStages?: number
    totalStages?: number
    stages?: Array<{
      id: ProcessStageId
      name: string
      objective?: string
      state?: StageState
      gate?: {
        status?: GateStatus
        satisfiedRequirements?: number
        totalRequirements?: number
      }
    }>
  }
  observation?: {
    files?: {
      artifacts?: Array<{
        path: string
        name: string
        kind: string
        scope?: string
        modifiedAt?: string
      }>
    }
  }
  timeline?: {
    events?: TimelineItem[]
    all?: TimelineItem[]
  }
}

export interface BeaconViewModel {
  available: boolean
  project: BeaconProjectJson | null
  summary: ProjectSummary | null
  timeline: TimelineItem[]
  artifacts: ArtifactItem[]
  message?: string
  source: 'local' | 'server' | 'file-picker' | 'none'
  /** project.json mtime (ms) — 충돌 감지용 */
  projectMtime?: number | null
}

export const STAGE_META: Record<
  ProcessStageId,
  { name: string; objective: string }
> = {
  p0: { name: '기획', objective: '프로젝트 목적과 범위를 확인합니다.' },
  p1: { name: '디자인', objective: '구조와 중요한 설계 결정을 확인합니다.' },
  p2: { name: '개발', objective: '구현과 변경 이력이 연결되어 있는지 확인합니다.' },
  p3: { name: '검증', objective: '테스트 또는 검증 산출물의 근거를 확인합니다.' },
  p4: { name: '배포', objective: '릴리스·배포 근거를 확인합니다.' },
}

const STAGE_ORDER: ProcessStageId[] = ['p0', 'p1', 'p2', 'p3', 'p4']

export function defaultBeaconRoot(): string {
  if (typeof process !== 'undefined' && process.env?.BEACON_PROJECT_ROOT) {
    return process.env.BEACON_PROJECT_ROOT
  }
  if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
    return process.cwd()
  }
  return ''
}

export function parseBeaconProjectJson(raw: string): BeaconProjectJson | null {
  try {
    const value = JSON.parse(raw) as Partial<BeaconProjectJson>
    if (typeof value.version !== 'number' || typeof value.initializedAt !== 'string') {
      return null
    }
    const folio =
      value.folio && typeof value.folio === 'object'
        ? ({
            updatedAt:
              typeof value.folio.updatedAt === 'string'
                ? value.folio.updatedAt
                : value.initializedAt,
            baseVersion:
              typeof value.folio.baseVersion === 'number'
                ? value.folio.baseVersion
                : value.version,
            baseMtime:
              typeof value.folio.baseMtime === 'number' ? value.folio.baseMtime : null,
            name: typeof value.folio.name === 'string' ? value.folio.name : undefined,
            gates: value.folio.gates,
            artifacts: Array.isArray(value.folio.artifacts) ? value.folio.artifacts : [],
            edits: Array.isArray(value.folio.edits) ? value.folio.edits : [],
          } satisfies FolioProjectOverlay)
        : undefined

    return {
      version: value.version,
      initializedAt: value.initializedAt,
      name: typeof value.name === 'string' ? value.name : undefined,
      folio,
    }
  } catch {
    return null
  }
}

/** 서버: `.beacon/project.json` 읽기. 클라이언트에서는 text/file 옵션 사용. */
export async function readBeaconProjectJson(options?: {
  root?: string
  text?: string
  file?: File | Blob
}): Promise<BeaconProjectJson | null> {
  if (options?.text != null) {
    return parseBeaconProjectJson(options.text)
  }
  if (options?.file) {
    return parseBeaconProjectJson(await options.file.text())
  }

  if (typeof window !== 'undefined') {
    return null
  }

  const { readFile } = await import('node:fs/promises')
  const path = await import('node:path')
  const root = options?.root ?? defaultBeaconRoot()
  const filePath = path.join(root, '.beacon', 'project.json')
  try {
    const text = await readFile(filePath, 'utf8')
    return parseBeaconProjectJson(text)
  } catch {
    return null
  }
}

async function initSql() {
  const initSqlJs = (await import('sql.js')).default
  if (typeof window === 'undefined') {
    const path = await import('node:path')
    const { readFile } = await import('node:fs/promises')
    const wasmPath = path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm')
    const wasmBuffer = await readFile(wasmPath)
    return initSqlJs({
      // sql.js typings expect ArrayBuffer; Node Buffer underlying bytes work at runtime
      wasmBinary: wasmBuffer.buffer.slice(
        wasmBuffer.byteOffset,
        wasmBuffer.byteOffset + wasmBuffer.byteLength,
      ) as ArrayBuffer,
    })
  }
  return initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`,
  })
}

function rowToTimeline(eventJson: string, fallbackId: string): TimelineItem | null {
  try {
    const event = JSON.parse(eventJson) as Partial<TimelineItem> & {
      id?: string
      title?: string
      detail?: string
      occurredAt?: string
    }
    if (!event.title || !event.occurredAt) return null
    return {
      id: event.id ?? fallbackId,
      title: event.title,
      detail: event.detail ?? '',
      occurredAt: event.occurredAt,
      category: event.category,
      type: event.type,
      source: event.source,
    }
  } catch {
    return null
  }
}

function emptyDbPayload(): BeaconDbPayload {
  return { timeline: [], latestSnapshot: null, snapshotCount: 0 }
}

/** sql.js로 beacon.db 바이트에서 Timeline / 최신 스냅샷 추출 (브라우저·파일 선택용) */
export async function parseBeaconDbBytes(bytes: Uint8Array): Promise<BeaconDbPayload> {
  const SQL = await initSql()
  const db = new SQL.Database(bytes)
  try {
    const timeline: TimelineItem[] = []
    try {
      const result = db.exec(
        `SELECT id, event_json FROM timeline_events ORDER BY occurred_at_ms DESC, id DESC LIMIT 80`,
      )
      const rows = result[0]
      if (rows) {
        for (const values of rows.values) {
          const id = String(values[0] ?? '')
          const json = String(values[1] ?? '')
          const item = rowToTimeline(json, id)
          if (item) timeline.push(item)
        }
      }
    } catch {
      // 테이블 없음
    }

    let latestSnapshot: BeaconSnapshotLike | null = null
    let snapshotCount = 0
    try {
      const countResult = db.exec(`SELECT COUNT(*) FROM project_snapshots`)
      snapshotCount = Number(countResult[0]?.values[0]?.[0] ?? 0)
      const snapResult = db.exec(
        `SELECT snapshot_json FROM project_snapshots ORDER BY id DESC LIMIT 1`,
      )
      const json = snapResult[0]?.values[0]?.[0]
      if (typeof json === 'string') {
        latestSnapshot = JSON.parse(json) as BeaconSnapshotLike
      }
    } catch {
      // 테이블 없음
    }

    return { timeline, latestSnapshot, snapshotCount }
  } finally {
    db.close()
  }
}

/**
 * 서버: node:sqlite 로 경로 직접 열기 (WAL 반영).
 * Beacon CLI가 WAL 모드로 쓰므로 sql.js로 메인 파일만 읽으면 스냅샷이 비어 보일 수 있다.
 */
async function readBeaconDbFromPath(filePath: string): Promise<BeaconDbPayload | null> {
  try {
    // Node 22+ built-in. @types/node 20에는 타입이 없어 동적 로드한다.
    const sqlite = (await import(
      // @ts-expect-error node:sqlite is available at runtime on Node 22+
      'node:sqlite'
    )) as {
      DatabaseSync: new (
        path: string,
        options?: { readOnly?: boolean },
      ) => {
        prepare: (sql: string) => {
          all: (...params: unknown[]) => unknown[]
          get: (...params: unknown[]) => unknown
        }
        exec: (sql: string) => void
        close: () => void
      }
    }
    const db = new sqlite.DatabaseSync(filePath, { readOnly: true })
    try {
      try {
        db.exec('PRAGMA wal_checkpoint(PASSIVE)')
      } catch {
        // ignore
      }

      const timeline: TimelineItem[] = []
      try {
        const rows = db
          .prepare(
            `SELECT id, event_json FROM timeline_events ORDER BY occurred_at_ms DESC, id DESC LIMIT 80`,
          )
          .all() as Array<{ id: number | string; event_json: string }>
        for (const row of rows) {
          const item = rowToTimeline(row.event_json, String(row.id))
          if (item) timeline.push(item)
        }
      } catch {
        // 테이블 없음
      }

      let latestSnapshot: BeaconSnapshotLike | null = null
      let snapshotCount = 0
      try {
        const countRow = db.prepare(`SELECT COUNT(*) AS c FROM project_snapshots`).get() as
          | { c: number }
          | undefined
        snapshotCount = Number(countRow?.c ?? 0)
        const snapRow = db
          .prepare(`SELECT snapshot_json FROM project_snapshots ORDER BY id DESC LIMIT 1`)
          .get() as { snapshot_json: string } | undefined
        if (snapRow?.snapshot_json) {
          latestSnapshot = JSON.parse(snapRow.snapshot_json) as BeaconSnapshotLike
        }
      } catch {
        // 테이블 없음
      }

      return { timeline, latestSnapshot, snapshotCount }
    } finally {
      db.close()
    }
  } catch {
    // node:sqlite 없거나 파일 잠금 → 바이트 폴백
    try {
      const { readFile } = await import('node:fs/promises')
      const buf = await readFile(filePath)
      return parseBeaconDbBytes(new Uint8Array(buf))
    } catch {
      return null
    }
  }
}

/** 서버: `.beacon/beacon.db` 읽기. 클라이언트: bytes/file 옵션. */
export async function readBeaconDb(options?: {
  root?: string
  bytes?: Uint8Array
  file?: File | Blob
}): Promise<BeaconDbPayload | null> {
  if (options?.bytes) {
    return parseBeaconDbBytes(options.bytes)
  }
  if (options?.file) {
    const buffer = await options.file.arrayBuffer()
    return parseBeaconDbBytes(new Uint8Array(buffer))
  }

  if (typeof window !== 'undefined') {
    return null
  }

  const path = await import('node:path')
  const { access } = await import('node:fs/promises')
  const root = options?.root ?? defaultBeaconRoot()
  const filePath = path.join(root, '.beacon', 'beacon.db')
  try {
    await access(filePath)
  } catch {
    return emptyDbPayload()
  }
  return readBeaconDbFromPath(filePath)
}

function emptyStages(): StageSummary[] {
  return STAGE_ORDER.map((id) => ({
    id,
    name: STAGE_META[id].name,
    objective: STAGE_META[id].objective,
    state: 'unknown' as StageState,
    gateStatus: 'unknown' as GateStatus,
    satisfiedRequirements: 0,
    totalRequirements: 0,
  }))
}

export function getProjectSummary(input: {
  project: BeaconProjectJson | null
  snapshot?: BeaconSnapshotLike | null
  fallbackName?: string
}): ProjectSummary {
  const { project, snapshot, fallbackName } = input
  const name =
    project?.name?.trim() ||
    fallbackName?.trim() ||
    'Beacon 프로젝트'

  const process = snapshot?.process
  if (process?.stages?.length) {
    const stages: StageSummary[] = STAGE_ORDER.map((id) => {
      const found = process.stages?.find((s) => s.id === id)
      const meta = STAGE_META[id]
      return {
        id,
        name: found?.name ?? meta.name,
        objective: found?.objective ?? meta.objective,
        state: (found?.state as StageState) ?? 'unknown',
        gateStatus: (found?.gate?.status as GateStatus) ?? 'unknown',
        satisfiedRequirements: found?.gate?.satisfiedRequirements ?? 0,
        totalRequirements: found?.gate?.totalRequirements ?? 0,
      }
    })
    const readyStages = process.readyStages ?? stages.filter((s) => s.gateStatus === 'ready').length
    const totalStages = process.totalStages ?? 5
    const currentGate = (process.currentStageId as ProcessStageId | null) ?? null
    return {
      name,
      initializedAt: project?.initializedAt ?? null,
      currentGate,
      currentGateLabel: currentGate ? STAGE_META[currentGate].name : null,
      progressPercent: Math.round((readyStages / totalStages) * 100),
      readyStages,
      totalStages,
      stages,
      scannedAt: snapshot?.scannedAt ?? null,
    }
  }

  return {
    name,
    initializedAt: project?.initializedAt ?? null,
    currentGate: null,
    currentGateLabel: null,
    progressPercent: 0,
    readyStages: 0,
    totalStages: 5,
    stages: emptyStages(),
    scannedAt: snapshot?.scannedAt ?? null,
  }
}

export function getTimeline(input: {
  db?: BeaconDbPayload | null
  snapshot?: BeaconSnapshotLike | null
  limit?: number
}): TimelineItem[] {
  const limit = input.limit ?? 40
  const fromDb = input.db?.timeline ?? []
  if (fromDb.length > 0) {
    return fromDb.slice(0, limit)
  }
  const fromSnap =
    input.snapshot?.timeline?.all ??
    input.snapshot?.timeline?.events ??
    []
  return [...fromSnap]
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, limit)
}

export function getArtifacts(input: {
  snapshot?: BeaconSnapshotLike | null
}): ArtifactItem[] {
  const list = input.snapshot?.observation?.files?.artifacts ?? []
  return list
    .filter((a) => a.scope !== 'support')
    .map((a) => ({
      path: a.path,
      name: a.name,
      kind: a.kind,
      scope: a.scope,
      modifiedAt: a.modifiedAt,
      present: true,
    }))
    .sort((a, b) => a.path.localeCompare(b.path))
}

export function buildBeaconViewModel(input: {
  project: BeaconProjectJson | null
  db?: BeaconDbPayload | null
  fallbackName?: string
  source: BeaconViewModel['source']
  folioTimeline?: TimelineItem[]
}): BeaconViewModel {
  if (!input.project) {
    return {
      available: false,
      project: null,
      summary: null,
      timeline: [],
      artifacts: [],
      message: 'Beacon 프로젝트를 초기화하세요',
      source: 'none',
    }
  }

  const snapshot = input.db?.latestSnapshot ?? null
  let summary = getProjectSummary({
    project: input.project,
    snapshot,
    fallbackName: input.fallbackName,
  })

  // Folio 오버레이 적용 (이름 · Gate)
  const folio = input.project.folio
  if (folio) {
    const name = folio.name?.trim() || input.project.name?.trim() || summary.name
    const stages = summary.stages.map((stage) => {
      const gate = folio.gates?.[stage.id]
      if (!gate) return stage
      return {
        ...stage,
        gateStatus: gate.status,
        state: gate.state ?? stage.state,
      }
    })
    const readyStages = stages.filter((s) => s.gateStatus === 'ready').length
    summary = {
      ...summary,
      name,
      stages,
      readyStages,
      progressPercent: Math.round((readyStages / summary.totalStages) * 100),
    }
  }

  const fromSnap = getArtifacts({ snapshot })
  const artMap = new Map(fromSnap.map((a) => [a.path, a]))
  for (const a of folio?.artifacts ?? []) {
    artMap.set(a.path, {
      path: a.path,
      name: a.name,
      kind: a.kind,
      scope: a.category,
      modifiedAt: a.modifiedAt,
      present: a.present,
    })
  }
  const artifacts = Array.from(artMap.values()).sort((a, b) => a.path.localeCompare(b.path))

  const fromDb = getTimeline({ db: input.db, snapshot })
  const tlMap = new Map(fromDb.map((t) => [t.id, t]))
  for (const t of input.folioTimeline ?? []) {
    tlMap.set(t.id, t)
  }
  const timeline = Array.from(tlMap.values())
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, 40)

  return {
    available: true,
    project: input.project,
    summary,
    timeline,
    artifacts,
    source: input.source,
  }
}

/** 클라이언트: 서버 API에서 요약 로드 */
export async function fetchBeaconSummary(): Promise<BeaconViewModel> {
  const res = await fetch('/api/beacon/summary', { cache: 'no-store' })
  if (!res.ok) {
    return {
      available: false,
      project: null,
      summary: null,
      timeline: [],
      artifacts: [],
      message: 'Beacon 프로젝트를 초기화하세요',
      source: 'none',
    }
  }
  return (await res.json()) as BeaconViewModel
}

type DirHandle = FileSystemDirectoryHandle & {
  values: () => AsyncIterableIterator<FileSystemHandle>
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FileSystemDirectoryHandle>
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FileSystemFileHandle>
}

async function readFileFromDir(
  dir: DirHandle,
  name: string,
): Promise<File | null> {
  try {
    const handle = await dir.getFileHandle(name)
    return await handle.getFile()
  } catch {
    return null
  }
}

/** 브라우저 File System Access API로 `.beacon` 폴더(또는 프로젝트 루트) 선택 */
export async function loadBeaconFromDirectoryPicker(): Promise<BeaconViewModel> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    return {
      available: false,
      project: null,
      summary: null,
      timeline: [],
      artifacts: [],
      message: '이 브라우저는 폴더 선택을 지원하지 않습니다',
      source: 'none',
    }
  }

  const root = (await (
    window as Window & {
      showDirectoryPicker: () => Promise<DirHandle>
    }
  ).showDirectoryPicker()) as DirHandle

  let beaconDir: DirHandle | null = null
  try {
    beaconDir = (await root.getDirectoryHandle('.beacon')) as DirHandle
  } catch {
    // 선택 자체가 .beacon 일 수 있음
    const projectFile = await readFileFromDir(root, 'project.json')
    if (projectFile) {
      beaconDir = root
    }
  }

  if (!beaconDir) {
    return {
      available: false,
      project: null,
      summary: null,
      timeline: [],
      artifacts: [],
      message: 'Beacon 프로젝트를 초기화하세요',
      source: 'none',
    }
  }

  const projectFile = await readFileFromDir(beaconDir, 'project.json')
  const project = projectFile ? await readBeaconProjectJson({ file: projectFile }) : null
  if (!project) {
    return {
      available: false,
      project: null,
      summary: null,
      timeline: [],
      artifacts: [],
      message: 'Beacon 프로젝트를 초기화하세요',
      source: 'none',
    }
  }

  const dbFile = await readFileFromDir(beaconDir, 'beacon.db')
  const db = dbFile ? await readBeaconDb({ file: dbFile }) : null

  return buildBeaconViewModel({
    project,
    db,
    fallbackName: root.name,
    source: 'file-picker',
  })
}

/* -------------------------------------------------------------------------- */
/* P21 — 변경 감지 · Folio 스냅샷 · Diff                                      */
/* -------------------------------------------------------------------------- */

export type BeaconFileMtimes = {
  available: boolean
  root: string
  projectJson: number | null
  beaconDb: number | null
  checkedAt: string
}

export type FolioBeaconSnapshotSource = 'auto' | 'manual' | 'change'

export type FolioBeaconSnapshot = {
  id: string
  createdAt: string
  source: FolioBeaconSnapshotSource
  project: BeaconProjectJson | null
  summary: ProjectSummary | null
  timeline: TimelineItem[]
  mtimes: {
    projectJson: number | null
    beaconDb: number | null
  }
}

export type FolioBeaconSnapshotMeta = {
  id: string
  createdAt: string
  source: FolioBeaconSnapshotSource
  projectVersion: number | null
  timelineCount: number
}

export type DiffKind = 'added' | 'removed' | 'modified' | 'unchanged'

export type FieldDiff = {
  field: string
  kind: DiffKind
  before: string | null
  after: string | null
}

export type TimelineDiffItem = {
  id: string
  kind: 'added' | 'removed' | 'modified'
  before?: TimelineItem
  after?: TimelineItem
}

export type BeaconWatchEvent = {
  changed: boolean
  mtimes: BeaconFileMtimes
  previous: BeaconFileMtimes | null
}

const SNAPSHOT_DIR = '.beacon/snapshots'
const SNAPSHOT_KEEP = 30
const SNAPSHOT_PREFIX = 'folio-'

async function safeMtimeMs(filePath: string): Promise<number | null> {
  try {
    const { stat } = await import('node:fs/promises')
    const st = await stat(filePath)
    return Math.floor(st.mtimeMs)
  } catch {
    return null
  }
}

/** 서버: project.json / beacon.db mtime */
export async function getBeaconFileMtimes(root?: string): Promise<BeaconFileMtimes> {
  if (typeof window !== 'undefined') {
    return {
      available: false,
      root: '',
      projectJson: null,
      beaconDb: null,
      checkedAt: new Date().toISOString(),
    }
  }
  const path = await import('node:path')
  const projectRoot = root ?? defaultBeaconRoot()
  const projectJson = await safeMtimeMs(path.join(projectRoot, '.beacon', 'project.json'))
  const beaconDb = await safeMtimeMs(path.join(projectRoot, '.beacon', 'beacon.db'))
  return {
    available: projectJson != null,
    root: projectRoot,
    projectJson,
    beaconDb,
    checkedAt: new Date().toISOString(),
  }
}

function mtimesEqual(a: BeaconFileMtimes | null, b: BeaconFileMtimes): boolean {
  if (!a) return false
  return a.projectJson === b.projectJson && a.beaconDb === b.beaconDb
}

function snapshotsDir(root: string, pathMod: typeof import('node:path')): string {
  return pathMod.join(root, SNAPSHOT_DIR)
}

function snapshotFileName(id: string): string {
  return `${id}.json`
}

/** project.json 필드 단위 diff */
export function diffBeaconProject(
  before: BeaconProjectJson | null,
  after: BeaconProjectJson | null,
): FieldDiff[] {
  const fields: Array<keyof BeaconProjectJson> = ['version', 'initializedAt', 'name']
  return fields.map((field) => {
    const b = before?.[field]
    const a = after?.[field]
    const beforeStr = b === undefined || b === null ? null : String(b)
    const afterStr = a === undefined || a === null ? null : String(a)
    let kind: DiffKind = 'unchanged'
    if (beforeStr == null && afterStr != null) kind = 'added'
    else if (beforeStr != null && afterStr == null) kind = 'removed'
    else if (beforeStr !== afterStr) kind = 'modified'
    return { field, kind, before: beforeStr, after: afterStr }
  })
}

/** Timeline 항목 id 기준 추가/삭제/수정 */
export function diffBeaconTimeline(
  before: TimelineItem[],
  after: TimelineItem[],
): TimelineDiffItem[] {
  const beforeMap = new Map(before.map((t) => [t.id, t]))
  const afterMap = new Map(after.map((t) => [t.id, t]))
  const ids = new Set([...beforeMap.keys(), ...afterMap.keys()])
  const result: TimelineDiffItem[] = []

  for (const id of ids) {
    const b = beforeMap.get(id)
    const a = afterMap.get(id)
    if (b && !a) {
      result.push({ id, kind: 'removed', before: b })
      continue
    }
    if (!b && a) {
      result.push({ id, kind: 'added', after: a })
      continue
    }
    if (b && a) {
      const same =
        b.title === a.title &&
        b.detail === a.detail &&
        b.occurredAt === a.occurredAt &&
        b.category === a.category &&
        b.type === a.type
      if (!same) result.push({ id, kind: 'modified', before: b, after: a })
    }
  }

  const order = { added: 0, modified: 1, removed: 2 } as const
  return result.sort((x, y) => order[x.kind] - order[y.kind] || x.id.localeCompare(y.id))
}

async function readFallbackPackageName(root: string): Promise<string | undefined> {
  try {
    const { readFile } = await import('node:fs/promises')
    const path = await import('node:path')
    const raw = await readFile(path.join(root, 'package.json'), 'utf8')
    const pkg = JSON.parse(raw) as { name?: unknown }
    return typeof pkg.name === 'string' && pkg.name.trim() ? pkg.name.trim() : undefined
  } catch {
    return undefined
  }
}

/** 서버: 현재 Beacon 상태를 Folio 스냅샷으로 저장 */
export async function createFolioBeaconSnapshot(options?: {
  root?: string
  source?: FolioBeaconSnapshotSource
}): Promise<FolioBeaconSnapshot | null> {
  if (typeof window !== 'undefined') return null

  const path = await import('node:path')
  const { mkdir, writeFile, readdir, unlink } = await import('node:fs/promises')
  const root = options?.root ?? defaultBeaconRoot()
  const source = options?.source ?? 'manual'
  const mtimes = await getBeaconFileMtimes(root)
  if (!mtimes.available) return null

  const project = await readBeaconProjectJson({ root })
  if (!project) return null

  const db = await readBeaconDb({ root })
  const fallbackName = await readFallbackPackageName(root)
  const view = buildBeaconViewModel({
    project,
    db,
    fallbackName,
    source: 'server',
  })

  const createdAt = new Date().toISOString()
  const id = `${SNAPSHOT_PREFIX}${createdAt.replace(/[:.]/g, '-')}`
  const snap: FolioBeaconSnapshot = {
    id,
    createdAt,
    source,
    project,
    summary: view.summary,
    timeline: view.timeline,
    mtimes: {
      projectJson: mtimes.projectJson,
      beaconDb: mtimes.beaconDb,
    },
  }

  const dir = snapshotsDir(root, path)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, snapshotFileName(id)), `${JSON.stringify(snap, null, 2)}\n`, 'utf8')

  // 오래된 스냅샷 정리
  try {
    const files = (await readdir(dir))
      .filter((f) => f.startsWith(SNAPSHOT_PREFIX) && f.endsWith('.json'))
      .sort()
      .reverse()
    for (const stale of files.slice(SNAPSHOT_KEEP)) {
      await unlink(path.join(dir, stale)).catch(() => undefined)
    }
  } catch {
    /* ignore prune errors */
  }

  return snap
}

/** 서버: 스냅샷 목록 (최신순) */
export async function listFolioBeaconSnapshots(root?: string): Promise<FolioBeaconSnapshotMeta[]> {
  if (typeof window !== 'undefined') return []

  const path = await import('node:path')
  const { readdir, readFile } = await import('node:fs/promises')
  const projectRoot = root ?? defaultBeaconRoot()
  const dir = snapshotsDir(projectRoot, path)

  let files: string[] = []
  try {
    files = (await readdir(dir))
      .filter((f) => f.startsWith(SNAPSHOT_PREFIX) && f.endsWith('.json'))
      .sort()
      .reverse()
  } catch {
    return []
  }

  const metas: FolioBeaconSnapshotMeta[] = []
  for (const file of files.slice(0, SNAPSHOT_KEEP)) {
    try {
      const raw = await readFile(path.join(dir, file), 'utf8')
      const snap = JSON.parse(raw) as FolioBeaconSnapshot
      metas.push({
        id: snap.id,
        createdAt: snap.createdAt,
        source: snap.source,
        projectVersion: snap.project?.version ?? null,
        timelineCount: snap.timeline?.length ?? 0,
      })
    } catch {
      /* skip corrupt */
    }
  }
  return metas
}

/** 서버: 스냅샷 단건 */
export async function readFolioBeaconSnapshot(
  id: string,
  root?: string,
): Promise<FolioBeaconSnapshot | null> {
  if (typeof window !== 'undefined') return null
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) return null

  const path = await import('node:path')
  const { readFile } = await import('node:fs/promises')
  const projectRoot = root ?? defaultBeaconRoot()
  try {
    const raw = await readFile(path.join(snapshotsDir(projectRoot, path), snapshotFileName(id)), 'utf8')
    return JSON.parse(raw) as FolioBeaconSnapshot
  } catch {
    return null
  }
}

/** 클라이언트: mtime 조회 */
export async function fetchBeaconMtimes(): Promise<BeaconFileMtimes> {
  try {
    const res = await fetch('/api/beacon/mtime', { cache: 'no-store' })
    if (!res.ok) {
      return {
        available: false,
        root: '',
        projectJson: null,
        beaconDb: null,
        checkedAt: new Date().toISOString(),
      }
    }
    return (await res.json()) as BeaconFileMtimes
  } catch {
    return {
      available: false,
      root: '',
      projectJson: null,
      beaconDb: null,
      checkedAt: new Date().toISOString(),
    }
  }
}

/**
 * 클라이언트: project.json / beacon.db 변경 폴링.
 * lastModified(mtime) 비교로 변경 여부 판단.
 */
export function watchBeaconFiles(options?: {
  intervalMs?: number
  onChange?: (event: BeaconWatchEvent) => void
  onTick?: (mtimes: BeaconFileMtimes) => void
}): { stop: () => void } {
  const intervalMs = options?.intervalMs ?? 5000
  let previous: BeaconFileMtimes | null = null
  let stopped = false
  let timer: ReturnType<typeof setInterval> | null = null

  const tick = async () => {
    if (stopped) return
    const mtimes = await fetchBeaconMtimes()
    options?.onTick?.(mtimes)
    const changed = previous != null && !mtimesEqual(previous, mtimes)
    if (changed) {
      options?.onChange?.({ changed: true, mtimes, previous })
    }
    previous = mtimes
  }

  void tick()
  timer = setInterval(() => {
    void tick()
  }, intervalMs)

  return {
    stop: () => {
      stopped = true
      if (timer) clearInterval(timer)
      timer = null
    },
  }
}

/** 클라이언트: 스냅샷 목록 */
export async function fetchBeaconSnapshots(): Promise<FolioBeaconSnapshotMeta[]> {
  try {
    const res = await fetch('/api/beacon/snapshots', { cache: 'no-store' })
    if (!res.ok) return []
    const json = (await res.json()) as { snapshots?: FolioBeaconSnapshotMeta[] }
    return json.snapshots ?? []
  } catch {
    return []
  }
}

/** 클라이언트: 스냅샷 생성 */
export async function createBeaconSnapshotClient(
  source: FolioBeaconSnapshotSource = 'manual',
): Promise<FolioBeaconSnapshot | null> {
  try {
    const res = await fetch('/api/beacon/snapshots', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ source }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { snapshot?: FolioBeaconSnapshot | null }
    return json.snapshot ?? null
  } catch {
    return null
  }
}

/** 클라이언트: 스냅샷 단건 */
export async function fetchBeaconSnapshot(id: string): Promise<FolioBeaconSnapshot | null> {
  try {
    const res = await fetch(`/api/beacon/snapshots/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = (await res.json()) as { snapshot?: FolioBeaconSnapshot | null }
    return json.snapshot ?? null
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* P23 — 클라이언트 쓰기                                                      */
/* -------------------------------------------------------------------------- */

export type BeaconProjectPutResult = {
  ok: boolean
  conflict?: boolean
  message?: string
  project?: BeaconProjectJson
  mtime?: number | null
  artifactPath?: string
}

/** project.json Folio 오버레이 저장 */
export async function putBeaconProject(body: {
  expectedMtime: number | null
  strategy?: 'merge' | 'reapply'
  name?: string
  gates?: Partial<Record<ProcessStageId, FolioGateOverlay>>
  artifacts?: FolioArtifactOverlay[]
}): Promise<BeaconProjectPutResult> {
  try {
    const res = await fetch('/api/beacon/project', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify(body),
    })
    const json = (await res.json()) as BeaconProjectPutResult
    return json
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'network_error' }
  }
}

/** Docs → Beacon artifact export */
export async function exportDocToBeacon(body: {
  title: string
  content: string
  category: string
  docId?: string
  expectedMtime?: number | null
  strategy?: 'merge' | 'reapply'
}): Promise<BeaconProjectPutResult> {
  try {
    const res = await fetch('/api/beacon/artifacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify(body),
    })
    const json = (await res.json()) as BeaconProjectPutResult
    return json
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'network_error' }
  }
}
