/**
 * P23 — Folio ↔ Beacon 양방향 동기화 (서버)
 * - project.json 의 `folio` 오버레이는 append-only edits
 * - CLI 원본 필드(version/initializedAt)는 보존
 * - Timeline 은 `.beacon/folio-timeline.jsonl` 에 append
 * - 산출물 파일은 `.beacon/artifacts/folio/<category>/`
 */

import {
  defaultBeaconRoot,
  getBeaconFileMtimes,
  parseBeaconProjectJson,
  type ArtifactItem,
  type BeaconProjectJson,
  type FolioArtifactOverlay,
  type FolioGateOverlay,
  type FolioProjectEdit,
  type FolioProjectOverlay,
  type GateStatus,
  type ProcessStageId,
  type StageState,
  type TimelineItem,
} from '@/lib/beacon'

export type ConflictStrategy = 'merge' | 'reapply'

export type ProjectWriteInput = {
  expectedMtime: number | null
  strategy?: ConflictStrategy
  name?: string
  gates?: Partial<Record<ProcessStageId, FolioGateOverlay>>
  artifacts?: FolioArtifactOverlay[]
  edit?: Omit<FolioProjectEdit, 'at'> & { at?: string }
}

export type ProjectWriteResult =
  | {
      ok: true
      conflict: false
      project: BeaconProjectJson
      mtime: number | null
    }
  | {
      ok: false
      conflict: true
      message: string
      project: BeaconProjectJson
      mtime: number | null
    }
  | {
      ok: false
      conflict: false
      message: string
    }

function slugify(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'untitled'
  )
}

export function categoryToArtifactKind(category: string): string {
  const c = category.trim().toLowerCase()
  if (c.includes('arch') || c.includes('설계') || c.includes('design')) return 'design'
  if (c.includes('meet') || c.includes('회의')) return 'notes'
  if (c.includes('test') || c.includes('qa') || c.includes('검증')) return 'verification'
  if (c.includes('deploy') || c.includes('배포') || c.includes('release')) return 'release'
  if (c.includes('plan') || c.includes('기획')) return 'planning'
  return 'docs'
}

async function projectJsonPath(root: string) {
  const path = await import('node:path')
  return path.join(root, '.beacon', 'project.json')
}

async function folioTimelinePath(root: string) {
  const path = await import('node:path')
  return path.join(root, '.beacon', 'folio-timeline.jsonl')
}

async function readRawProject(root: string): Promise<{
  project: BeaconProjectJson | null
  raw: string | null
  mtime: number | null
}> {
  const { readFile, stat } = await import('node:fs/promises')
  const filePath = await projectJsonPath(root)
  try {
    const [raw, st] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)])
    return {
      project: parseBeaconProjectJson(raw),
      raw,
      mtime: Math.floor(st.mtimeMs),
    }
  } catch {
    return { project: null, raw: null, mtime: null }
  }
}

function ensureOverlay(project: BeaconProjectJson, mtime: number | null): FolioProjectOverlay {
  const existing = project.folio
  return {
    updatedAt: existing?.updatedAt ?? new Date().toISOString(),
    baseVersion: existing?.baseVersion ?? project.version,
    baseMtime: existing?.baseMtime ?? mtime,
    name: existing?.name ?? project.name,
    gates: { ...(existing?.gates ?? {}) },
    artifacts: [...(existing?.artifacts ?? [])],
    edits: [...(existing?.edits ?? [])],
  }
}

function appendEdit(overlay: FolioProjectOverlay, edit: FolioProjectEdit): FolioProjectOverlay {
  return {
    ...overlay,
    updatedAt: edit.at,
    edits: [...overlay.edits, edit].slice(-200),
  }
}

/** append-only project.json 업데이트 */
export async function writeBeaconProjectOverlay(
  input: ProjectWriteInput,
  root = defaultBeaconRoot(),
): Promise<ProjectWriteResult> {
  if (typeof window !== 'undefined') {
    return { ok: false, conflict: false, message: 'server_only' }
  }

  const { writeFile, mkdir } = await import('node:fs/promises')
  const path = await import('node:path')
  const current = await readRawProject(root)
  if (!current.project) {
    return { ok: false, conflict: false, message: 'beacon_unavailable' }
  }

  const strategy = input.strategy
  const mtimeMismatch =
    input.expectedMtime != null &&
    current.mtime != null &&
    input.expectedMtime !== current.mtime

  if (mtimeMismatch && strategy !== 'merge' && strategy !== 'reapply') {
    return {
      ok: false,
      conflict: true,
      message: 'project.json 이 외부에서 변경되었습니다. 병합 또는 재적용을 선택하세요.',
      project: current.project,
      mtime: current.mtime,
    }
  }

  // merge / reapply: 최신 파일 위에 Folio 변경 append
  let project = current.project
  let overlay = ensureOverlay(project, current.mtime)
  const at = input.edit?.at ?? new Date().toISOString()

  if (input.name != null) {
    const nextName = input.name.trim()
    project = { ...project, name: nextName || project.name }
    overlay = {
      ...overlay,
      name: nextName || overlay.name,
    }
    overlay = appendEdit(overlay, {
      at,
      op: 'rename',
      detail: nextName,
    })
  }

  if (input.gates) {
    overlay = {
      ...overlay,
      gates: { ...overlay.gates, ...input.gates },
    }
    for (const [stageId, gate] of Object.entries(input.gates)) {
      overlay = appendEdit(overlay, {
        at,
        op: 'gate',
        stageId: stageId as ProcessStageId,
        detail: gate?.status,
      })
    }
  }

  if (input.artifacts) {
    const byPath = new Map((overlay.artifacts ?? []).map((a) => [a.path, a]))
    for (const art of input.artifacts) {
      byPath.set(art.path, art)
    }
    overlay = {
      ...overlay,
      artifacts: Array.from(byPath.values()),
    }
    overlay = appendEdit(overlay, {
      at,
      op: 'artifacts',
      detail: `${input.artifacts.length} items`,
    })
  }

  if (input.edit && !input.name && !input.gates && !input.artifacts) {
    overlay = appendEdit(overlay, { ...input.edit, at })
  }

  overlay = {
    ...overlay,
    updatedAt: at,
    baseVersion: project.version,
    baseMtime: current.mtime,
  }

  const next: BeaconProjectJson = {
    ...project,
    folio: overlay,
  }

  const dir = path.join(root, '.beacon')
  await mkdir(dir, { recursive: true })
  const filePath = await projectJsonPath(root)
  await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  const mtimes = await getBeaconFileMtimes(root)

  return {
    ok: true,
    conflict: false,
    project: next,
    mtime: mtimes.projectJson,
  }
}

export async function exportDocAsBeaconArtifact(input: {
  title: string
  content: string
  category: string
  docId?: string
  expectedMtime?: number | null
  strategy?: ConflictStrategy
}): Promise<
  ProjectWriteResult & { artifactPath?: string }
> {
  if (typeof window !== 'undefined') {
    return { ok: false, conflict: false, message: 'server_only' }
  }

  const root = defaultBeaconRoot()
  const { mkdir, writeFile } = await import('node:fs/promises')
  const path = await import('node:path')

  const kind = categoryToArtifactKind(input.category)
  const categorySlug = slugify(input.category || 'general')
  const fileSlug = slugify(input.title)
  const relPath = path.join('artifacts', 'folio', categorySlug, `${fileSlug}.md`)
  const absPath = path.join(root, '.beacon', relPath)

  await mkdir(path.dirname(absPath), { recursive: true })
  const body = `# ${input.title}\n\n<!-- folio-export category=${input.category} docId=${input.docId ?? ''} -->\n\n${input.content}\n`
  await writeFile(absPath, body, 'utf8')

  const artifact: FolioArtifactOverlay = {
    path: `.beacon/${relPath.replace(/\\/g, '/')}`,
    name: input.title,
    kind,
    category: input.category,
    present: true,
    source: 'folio',
    docId: input.docId,
    modifiedAt: new Date().toISOString(),
  }

  const result = await writeBeaconProjectOverlay(
    {
      expectedMtime: input.expectedMtime ?? null,
      strategy: input.strategy,
      artifacts: [artifact],
      edit: {
        op: 'export_doc',
        detail: artifact.path,
      },
    },
    root,
  )

  return { ...result, artifactPath: artifact.path }
}

export async function appendFolioTimelineEvent(
  event: Omit<TimelineItem, 'id' | 'occurredAt'> & {
    id?: string
    occurredAt?: string
  },
  root = defaultBeaconRoot(),
): Promise<TimelineItem | null> {
  if (typeof window !== 'undefined') return null

  const { mkdir, appendFile } = await import('node:fs/promises')
  const path = await import('node:path')
  const item: TimelineItem = {
    id: event.id ?? `folio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: event.title,
    detail: event.detail ?? '',
    occurredAt: event.occurredAt ?? new Date().toISOString(),
    category: event.category ?? 'folio',
    type: event.type ?? 'folio',
    source: event.source ?? 'folio',
  }

  const filePath = await folioTimelinePath(root)
  await mkdir(path.dirname(filePath), { recursive: true })
  await appendFile(filePath, `${JSON.stringify(item)}\n`, 'utf8')
  return item
}

export async function readFolioTimelineEvents(
  root = defaultBeaconRoot(),
  limit = 80,
): Promise<TimelineItem[]> {
  if (typeof window !== 'undefined') return []
  const { readFile } = await import('node:fs/promises')
  try {
    const raw = await readFile(await folioTimelinePath(root), 'utf8')
    const items: TimelineItem[] = []
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t) continue
      try {
        items.push(JSON.parse(t) as TimelineItem)
      } catch {
        /* skip */
      }
    }
    return items
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, limit)
  } catch {
    return []
  }
}

export function applyFolioOverlayToSummary(
  summary: {
    name: string
    stages: Array<{
      id: ProcessStageId
      gateStatus: GateStatus
      state: StageState
      name: string
      objective: string
      satisfiedRequirements: number
      totalRequirements: number
    }>
    currentGate: ProcessStageId | null
    currentGateLabel: string | null
    readyStages: number
    totalStages: number
    progressPercent: number
    initializedAt: string | null
    scannedAt: string | null
  },
  project: BeaconProjectJson,
) {
  const folio = project.folio
  if (!folio) return summary

  const name = folio.name?.trim() || project.name?.trim() || summary.name
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
  return {
    ...summary,
    name,
    stages,
    readyStages,
    progressPercent: Math.round((readyStages / summary.totalStages) * 100),
  }
}

export function mergeArtifacts(
  fromSnapshot: ArtifactItem[],
  folioArts?: FolioArtifactOverlay[],
): ArtifactItem[] {
  const map = new Map<string, ArtifactItem>()
  for (const a of fromSnapshot) {
    map.set(a.path, a)
  }
  for (const a of folioArts ?? []) {
    map.set(a.path, {
      path: a.path,
      name: a.name,
      kind: a.kind,
      scope: a.category,
      modifiedAt: a.modifiedAt,
      present: a.present,
    })
  }
  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path))
}

export function mergeTimelines(
  fromBeacon: TimelineItem[],
  fromFolio: TimelineItem[],
  limit = 40,
): TimelineItem[] {
  const map = new Map<string, TimelineItem>()
  for (const t of [...fromBeacon, ...fromFolio]) {
    map.set(t.id, t)
  }
  return Array.from(map.values())
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, limit)
}
