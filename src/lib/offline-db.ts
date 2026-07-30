/**
 * IndexedDB 오프라인 저장소 · 동기화 큐 (P26)
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

const DB_NAME = 'folio-offline'
const DB_VERSION = 1

export type OfflineDataType = 'journal' | 'docs' | 'board' | 'kv'

export type SyncQueueItem = {
  id: string
  type: 'journal' | 'docs' | 'board'
  /** 직렬화된 페이로드 힌트 */
  label: string
  payload: unknown
  createdAt: string
}

interface FolioOfflineDB extends DBSchema {
  store: {
    key: string
    value: { key: string; value: unknown; updatedAt: string }
  }
  syncQueue: {
    key: string
    value: SyncQueueItem
    indexes: { 'by-created': string }
  }
}

let dbPromise: Promise<IDBPDatabase<FolioOfflineDB>> | null = null

function getDb() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'))
  }
  if (!dbPromise) {
    dbPromise = openDB<FolioOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store', { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          const q = db.createObjectStore('syncQueue', { keyPath: 'id' })
          q.createIndex('by-created', 'createdAt')
        }
      },
    })
  }
  return dbPromise
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await getDb()
  await db.put('store', { key, value, updatedAt: new Date().toISOString() })
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await getDb()
  const row = await db.get('store', key)
  return row?.value as T | undefined
}

export async function idbDelete(key: string): Promise<void> {
  const db = await getDb()
  await db.delete('store', key)
}

export async function enqueueSync(
  item: Omit<SyncQueueItem, 'id' | 'createdAt'> & { id?: string },
): Promise<SyncQueueItem> {
  const db = await getDb()
  const row: SyncQueueItem = {
    id: item.id ?? crypto.randomUUID(),
    type: item.type,
    label: item.label,
    payload: item.payload,
    createdAt: new Date().toISOString(),
  }
  await db.put('syncQueue', row)
  window.dispatchEvent(new CustomEvent('folio-sync-queue', { detail: { count: await countSyncQueue() } }))
  return row
}

export async function listSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDb()
  return db.getAllFromIndex('syncQueue', 'by-created')
}

export async function countSyncQueue(): Promise<number> {
  const db = await getDb()
  return db.count('syncQueue')
}

export async function removeSyncItem(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('syncQueue', id)
  window.dispatchEvent(new CustomEvent('folio-sync-queue', { detail: { count: await countSyncQueue() } }))
}

export async function clearSyncQueue(): Promise<void> {
  const db = await getDb()
  await db.clear('syncQueue')
  window.dispatchEvent(new CustomEvent('folio-sync-queue', { detail: { count: 0 } }))
}

/** 온라인 복구 시 큐 처리 — handler가 true면 제거 */
export async function flushSyncQueue(
  handler: (item: SyncQueueItem) => Promise<boolean>,
): Promise<{ flushed: number; failed: number }> {
  const items = await listSyncQueue()
  let flushed = 0
  let failed = 0
  for (const item of items) {
    try {
      const ok = await handler(item)
      if (ok) {
        await removeSyncItem(item.id)
        flushed += 1
      } else {
        failed += 1
      }
    } catch {
      failed += 1
    }
  }
  return { flushed, failed }
}

export function isBrowserOffline(): boolean {
  if (typeof navigator === 'undefined') return false
  return !navigator.onLine
}
