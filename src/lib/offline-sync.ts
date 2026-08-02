/**
 * 오프라인 상태 · 온라인 복구 동기화 (P26)
 */
'use client'

import {
  countSyncQueue,
  enqueueSync,
  flushSyncQueue,
  idbSet,
  isBrowserOffline,
  type SyncQueueItem,
} from '@/lib/offline-db'
import { getStorageMode, saveBeaconCache, type StorageDataType } from '@/lib/storage'
import { showAppToast } from '@/lib/health-monitor'

const ONLINE_EVENT = 'folio-online-status'

export type OnlineStatusDetail = {
  online: boolean
  pending: number
}

export function subscribeOnlineStatus(
  listener: (detail: OnlineStatusDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined

  const emit = async () => {
    const pending = await countSyncQueue().catch(() => 0)
    listener({ online: navigator.onLine, pending })
  }

  const onOnline = () => {
    void emit()
    showAppToast('온라인으로 복구됨 · 동기화 중…')
    void syncWhenOnline()
  }
  const onOffline = () => void emit()
  const onQueue = () => void emit()

  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  window.addEventListener('folio-sync-queue', onQueue)
  void emit()

  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    window.removeEventListener('folio-sync-queue', onQueue)
  }
}

export async function mirrorToIndexedDb(type: StorageDataType, data: unknown): Promise<void> {
  try {
    await idbSet(`folio:${type}`, data)
  } catch {
    /* quota 등 무시 */
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

async function handleSyncItem(item: SyncQueueItem): Promise<boolean> {
  const mode = getStorageMode()
  if (mode === 'local') return true

  if (mode === 'beacon') {
    await saveBeaconCache(item.type, item.payload)
    return true
  }

  // cloud: journal/docs/board 모듈 동적 로드
  if (item.type === 'journal') {
    const { saveJournalSupabase } = await import('@/lib/journal')
    // payload는 Record 전체 또는 단일 — 가능한 경로만
    const data = item.payload as Record<string, { content: string; tags: string[] }>
    for (const [date, entry] of Object.entries(data)) {
      await saveJournalSupabase(date, entry.content, entry.tags ?? [])
    }
    return true
  }
  if (item.type === 'docs') {
    const { saveDocSupabase } = await import('@/lib/docs')
    const docs = item.payload as Array<{
      id: string
      title: string
      content: string
      category: string
      createdAt: string
      updatedAt: string
    }>
    if (Array.isArray(docs)) {
      for (const doc of docs) await saveDocSupabase(doc)
    }
    return true
  }
  if (item.type === 'board') {
    const { saveTasksSupabase } = await import('@/lib/board')
    await saveTasksSupabase(item.payload as Parameters<typeof saveTasksSupabase>[0])
    return true
  }
  return false
}

let syncing = false

export async function syncWhenOnline(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!navigator.onLine || syncing) return
  const pending = await countSyncQueue().catch(() => 0)
  if (pending === 0) return

  syncing = true
  try {
    const { flushed, failed } = await flushSyncQueue(handleSyncItem)
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
      showAppToast(`동기화 실패 ${failed}건 · 다음에 재시도`)
    }
  } finally {
    syncing = false
    window.dispatchEvent(
      new CustomEvent(ONLINE_EVENT, {
        detail: { online: true, pending: await countSyncQueue().catch(() => 0) },
      }),
    )
  }
}

export { isBrowserOffline }
