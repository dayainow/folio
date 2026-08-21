import {
  buildBeaconViewModel,
  type BeaconProjectJson,
  type BeaconViewModel,
  type FolioArtifactOverlay,
  type GateStatus,
  type ProcessStageId,
  type StageState,
  type TimelineItem,
} from '@/lib/beacon'
import { flushLocalJson, getLocalJson, setLocalJson } from '@/lib/local-cache'

const STORAGE_KEY = 'folio_local_process_v1'

type LocalProcessStore = {
  project: BeaconProjectJson
  timeline: TimelineItem[]
}

export type LocalProcessUpdate = {
  name?: string
  gates: Partial<Record<ProcessStageId, { status: GateStatus; state: StageState }>>
  artifacts: FolioArtifactOverlay[]
}

function createDefaultStore(now = new Date().toISOString()): LocalProcessStore {
  return {
    project: {
      version: 1,
      initializedAt: now,
      name: '내 업무 흐름',
      folio: {
        updatedAt: now,
        baseVersion: 1,
        baseMtime: null,
        name: '내 업무 흐름',
        gates: {},
        artifacts: [],
        edits: [],
      },
    },
    timeline: [],
  }
}

function readStore(): LocalProcessStore {
  const fallback = createDefaultStore()
  const stored = getLocalJson<LocalProcessStore | null>(STORAGE_KEY, null)
  if (!stored?.project || !Array.isArray(stored.timeline)) return fallback
  return stored
}

function toView(store: LocalProcessStore): BeaconViewModel {
  return buildBeaconViewModel({
    project: store.project,
    source: 'local',
    folioTimeline: store.timeline,
  })
}

export function loadLocalProcess(): BeaconViewModel {
  return toView(readStore())
}

export function saveLocalProcess(update: LocalProcessUpdate): BeaconViewModel {
  const store = readStore()
  const now = new Date().toISOString()
  const name = update.name?.trim() || store.project.folio?.name || store.project.name || '내 업무 흐름'
  const next: LocalProcessStore = {
    project: {
      ...store.project,
      name,
      folio: {
        updatedAt: now,
        baseVersion: store.project.version,
        baseMtime: null,
        name,
        gates: update.gates,
        artifacts: update.artifacts,
        edits: [
          ...(store.project.folio?.edits ?? []),
          { at: now, op: 'local_process_update', detail: 'Folio 로컬 프로세스 저장' },
        ].slice(-100),
      },
    },
    timeline: [
      {
        id: `local-process-${Date.now()}`,
        title: '업무 흐름 업데이트',
        detail: `${name}의 단계와 산출물을 저장했습니다.`,
        occurredAt: now,
        category: 'process',
        type: 'folio.process.updated',
        source: 'folio',
      },
      ...store.timeline,
    ].slice(0, 40),
  }
  setLocalJson(STORAGE_KEY, next)
  flushLocalJson(STORAGE_KEY)
  return toView(next)
}
