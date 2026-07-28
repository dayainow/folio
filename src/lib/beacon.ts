/**
 * Beacon 프로세스 상태 읽기 (읽기 전용)
 * - 서버: BEACON_PROJECT_ROOT 또는 process.cwd() 아래 `.beacon/`
 * - 클라이언트: File System Access API 또는 `/api/beacon/summary`
 */

export type ProcessStageId = 'p0' | 'p1' | 'p2' | 'p3' | 'p4'
export type GateStatus = 'ready' | 'needs_evidence' | 'unknown'
export type StageState = 'ready' | 'current' | 'upcoming' | 'unknown'

export interface BeaconProjectJson {
  version: number
  initializedAt: string
  name?: string
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
  source: 'server' | 'file-picker' | 'none'
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
    return {
      version: value.version,
      initializedAt: value.initializedAt,
      name: typeof value.name === 'string' ? value.name : undefined,
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
  const summary = getProjectSummary({
    project: input.project,
    snapshot,
    fallbackName: input.fallbackName,
  })
  return {
    available: true,
    project: input.project,
    summary,
    timeline: getTimeline({ db: input.db, snapshot }),
    artifacts: getArtifacts({ snapshot }),
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
