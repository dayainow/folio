/**
 * 오프라인 상태 · 온라인 복구 동기화 (P26/P44)
 * · Background Sync 연동
 * · 로컬 우선 + 서버 병합
 * · 동기화 단계 이벤트 (업로드/완료/실패)
 */
'use client'

import {
  countSyncQueue,
  enqueueSync,
  flushSyncQueue,
  idbGet,
  idbSet,
  isBrowserOffline,
  type SyncQueueItem,
} from '@/lib/offline-db'
import { getStorageMode, saveBeaconCache, type StorageDataType } from '@/lib/storage'
import { showAppToast } from '@/lib/health-monitor'

const ONLINE_EVENT = 'folio-online-status'
const SYNC_PHASE_EVENT = 'folio-sync-phase'

export type SyncPhase = 'idle' | 'uploading' | 'done' | 'failed'

export type OnlineStatusDetail = {
  online: boolean
  pending: number
  phase: SyncPhase
  lastError?: string | null
}

export type SyncPhaseDetail = {
  phase: SyncPhase
  pending: number
  flushed?: number
  failed?: number
  message?: string
}

let currentPhase: SyncPhase = 'idle'
let lastError: string | null = null

function emitPhase(detail: SyncPhaseDetail) {
  currentPhase = detail.phase
  if (detail.phase === 'failed') lastError = detail.message ?? lastError
  if (detail.phase === 'done' || detail.phase === 'idle') lastError = null
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SYNC_PHASE_EVENT, { detail }))
  window.dispatchEvent(
    new CustomEvent(ONLINE_EVENT, {
      detail: {
        online: navigator.onLine,
        pending: detail.pending,
        phase: detail.phase,
        lastError,
      } satisfies OnlineStatusDetail,
    }),
  )
}

export function getSyncPhase(): SyncPhase {
  return currentPhase
}

export function subscribeSyncPhase(listener: (d: SyncPhaseDetail) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = (e: Event) => listener((e as CustomEvent<SyncPhaseDetail>).detail)
  window.addEventListener(SYNC_PHASE_EVENT, handler)
  return () => window.removeEventListener(SYNC_PHASE_EVENT, handler)
}

export function subscribeOnlineStatus(
  listener: (detail: OnlineStatusDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined

  const emit = async () => {
    const pending = await countSyncQueue().catch(() => 0)
    listener({
      online: navigator.onLine,
      pending,
      phase: currentPhase,
      lastError,
    })
  }

  const onOnline = () => {
    void emit()
    showAppToast('온라인으로 복구됨 · 동기화 중…')
    void syncWhenOnline()
  }
  const onOffline = () => void emit()
  const onQueue = () => void emit()
  const onPhase = (e: Event) => {
    const d = (e as CustomEvent<SyncPhaseDetail>).detail
    void countSyncQueue()
      .catch(() => 0)
      .then((pending) =>
        listener({
          online: navigator.onLine,
          pending,
          phase: d.phase,
          lastError: d.phase === 'failed' ? d.message ?? null : null,
        }),
      )
  }

  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  window.addEventListener('folio-sync-queue', onQueue)
  window.addEventListener(SYNC_PHASE_EVENT, onPhase)
  void emit()

  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    window.removeEventListener('folio-sync-queue', onQueue)
    window.removeEventListener(SYNC_PHASE_EVENT, onPhase)
  }
}

export async function mirrorToIndexedDb(type: StorageDataType, data: unknown): Promise<void> {
  try {
    await idbSet(`folio:${type}`, data)
  } catch {
    /* quota 등 무시 */
  }
}

/** P57 — 오프라인 우선: IndexedDB 미러에서 부트스트랩 */
export async function hydrateFromIndexedDb<T>(
  type: StorageDataType,
): Promise<T | undefined> {
  try {
    return await idbGet<T>(`folio:${type}`)
  } catch {
    return undefined
  }
}

/** P57 — Background Sync / Periodic Sync 등록 */
export async function ensureBackgroundSync(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const syncManager = (
      reg as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> }
        periodicSync?: {
          register: (tag: string, opts: { minInterval: number }) => Promise<void>
        }
      }
    )
    if (syncManager.sync) {
      await syncManager.sync.register('folio-sync-queue')
    }
    if (syncManager.periodicSync) {
      try {
        await syncManager.periodicSync.register('folio-periodic-sync', {
          minInterval: 12 * 60 * 60 * 1000,
        })
      } catch {
        /* 권한/미지원 */
      }
    }
    return true
  } catch {
    return false
  }
}

/** 오프라인이거나 원격 실패 시 동기화 큐에 적재 */
export async function queueRemoteSync(
  type: StorageDataType,
  data: unknown,
  label: string,
): Promise<void> {
  try {
    await enqueueSync({ type, payload: data, label })
  } catch {
    /* ignore */
  }
}

/** P44 — 로컬 변경 우선, 원격에만 있는 키는 유지 */
function mergeJournalLocalFirst(
  local: Record<string, { date: string; content: string; tags: string[] }>,
  remote: Record<string, { date: string; content: string; tags: string[] }>,
): Record<string, { date: string; content: string; tags: string[] }> {
  const out: Record<string, { date: string; content: string; tags: string[] }> = { ...remote }
  for (const [entryKey, entry] of Object.entries(local)) {
    const remoteEntry = remote[entryKey]
    if (!remoteEntry) {
      out[entryKey] = entry
      continue
    }
    // 로컬 본문 우선 · 태그는 합집합
    const tags = Array.from(new Set([...(entry.tags ?? []), ...(remoteEntry.tags ?? [])]))
    out[entryKey] = {
      date: entry.date,
      content: entry.content,
      tags,
    }
  }
  return out
}

function mergeDocsLocalFirst<
  T extends { id: string; updatedAt: string; title: string; content: string },
>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>()
  for (const d of remote) map.set(d.id, d)
  for (const d of local) {
    const prev = map.get(d.id)
    if (!prev) {
      map.set(d.id, d)
      continue
    }
    // 로컬 updatedAt이 같거나 더 新し우면 로컬 우선
    if (d.updatedAt >= prev.updatedAt) map.set(d.id, d)
  }
  return [...map.values()]
}

async function handleSyncItem(item: SyncQueueItem): Promise<boolean> {
  const mode = getStorageMode()
  if (mode === 'local') return true

  if (mode === 'beacon') {
    await saveBeaconCache(item.type, item.payload)
    return true
  }

  if (item.type === 'journal') {
    const { saveJournalSupabase, loadJournalsSupabase } = await import('@/lib/journal')
    const data = item.payload as Record<string, { date: string; content: string; tags: string[] }>
    let remote: Record<string, { date: string; content: string; tags: string[] }> = {}
    try {
      remote = await loadJournalsSupabase()
    } catch {
      remote = {}
    }
    const merged = mergeJournalLocalFirst(data, remote)
    for (const [entryKey, entry] of Object.entries(data)) {
      const m = merged[entryKey] ?? entry
      await saveJournalSupabase(entryKey, m.date, m.content, m.tags ?? [])
    }
    return true
  }
  if (item.type === 'docs') {
    const { saveDocSupabase, loadDocsSupabase } = await import('@/lib/docs')
    const docs = item.payload as Array<{
      id: string
      title: string
      content: string
      category: string
      createdAt: string
      updatedAt: string
    }>
    if (!Array.isArray(docs)) return false
    let remote: typeof docs = []
    try {
      remote = await loadDocsSupabase()
    } catch {
      remote = []
    }
    const merged = mergeDocsLocalFirst(docs, remote)
    const localIds = new Set(docs.map((d) => d.id))
    for (const doc of merged) {
      if (localIds.has(doc.id)) await saveDocSupabase(doc)
    }
    return true
  }
  if (item.type === 'board') {
    const { saveTasksSupabase, loadTasksSupabase } = await import('@/lib/board')
    const local = item.payload as Parameters<typeof saveTasksSupabase>[0]
    try {
      const remote = await loadTasksSupabase()
      const byId = new Map(remote.map((t) => [t.id, t]))
      for (const t of local) byId.set(t.id, t) // 로컬 우선
      await saveTasksSupabase([...byId.values()])
    } catch {
      await saveTasksSupabase(local)
    }
    return true
  }
  return false
}

let syncing = false

export async function syncWhenOnline(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!navigator.onLine || syncing) return
  const pending = await countSyncQueue().catch(() => 0)
  if (pending === 0) {
    emitPhase({ phase: 'idle', pending: 0 })
    return
  }

  syncing = true
  emitPhase({ phase: 'uploading', pending, message: '업로드 중…' })
  try {
    const { flushed, failed } = await flushSyncQueue(handleSyncItem)
    const left = await countSyncQueue().catch(() => 0)
    if (failed > 0 && flushed === 0) {
      emitPhase({
        phase: 'failed',
        pending: left,
        flushed,
        failed,
        message: `동기화 실패 ${failed}건`,
      })
      showAppToast(`동기화 실패 ${failed}건 · 다음에 재시도`)
    } else {
      emitPhase({
        phase: 'done',
        pending: left,
        flushed,
        failed,
        message: flushed > 0 ? `${flushed}건 동기화됨` : undefined,
      })
      if (flushed > 0) {
        showAppToast(`오프라인 변경 ${flushed}건 동기화됨`)
        void import('@/lib/push-notifications').then(({ showFolioPush }) =>
          showFolioPush({
            title: '동기화 완료',
            body: `오프라인 변경 ${flushed}건이 반영되었습니다.`,
            url: '/',
            tag: 'folio-sync-done',
          }),
        )
      }
      if (failed > 0) {
        showAppToast(`일부 실패 ${failed}건 · 재시도 대기`)
      }
      window.setTimeout(() => {
        void countSyncQueue()
          .catch(() => 0)
          .then((p) => emitPhase({ phase: p > 0 ? 'idle' : 'idle', pending: p }))
      }, 2500)
    }
  } catch (err) {
    const left = await countSyncQueue().catch(() => 0)
    emitPhase({
      phase: 'failed',
      pending: left,
      message: err instanceof Error ? err.message : '동기화 오류',
    })
    showAppToast('동기화 중 오류 · 나중에 재시도')
  } finally {
    syncing = false
  }
}

export { isBrowserOffline }
