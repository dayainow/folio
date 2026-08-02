/**
 * Folio 저장 모드: local | cloud | beacon
 * - local: localStorage
 * - cloud: Supabase → 실패 시 local
 * - beacon: `.beacon/cache/folio-*.json` (서버 API) → 실패 시 local
 *
 * v2.0: `*WithFallback` 이중 경로는 의도된 아키텍처다 (오프라인·원격 장애 UX).
 * 저장은 항상 로컬을 선행한다. Beacon CLI 원본(project.json / beacon.db)은 건드리지 않는다.
 */

export type StorageMode = 'local' | 'cloud' | 'beacon'

/** saveWithFallback / Beacon 캐시 키 */
export type StorageDataType = 'journal' | 'docs' | 'board'

const MODE_KEY = 'folio_storage_mode'
const MODE_EVENT = 'folio-storage-mode'

const VALID: StorageMode[] = ['local', 'cloud', 'beacon']

export const STORAGE_MODE_LABELS: Record<StorageMode, string> = {
  local: '로컬',
  cloud: '클라우드',
  beacon: 'Beacon',
}

export function getStorageMode(): StorageMode {
  if (typeof window === 'undefined') return 'local'
  try {
    const raw = localStorage.getItem(MODE_KEY)
    if (raw && (VALID as string[]).includes(raw)) return raw as StorageMode
  } catch {
    /* ignore */
  }
  return 'local'
}

export function setStorageMode(mode: StorageMode): void {
  if (typeof window === 'undefined') return
  if (!(VALID as string[]).includes(mode)) return
  localStorage.setItem(MODE_KEY, mode)
  window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: mode }))
}

export function subscribeStorageMode(listener: (mode: StorageMode) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<StorageMode>).detail
    listener(detail ?? getStorageMode())
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === MODE_KEY) listener(getStorageMode())
  }
  window.addEventListener(MODE_EVENT, handler)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(MODE_EVENT, handler)
    window.removeEventListener('storage', onStorage)
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export type SaveWithFallbackResult = {
  mode: StorageMode
  usedFallback: boolean
}

function beaconFileType(type: StorageDataType): 'journals' | 'docs' | 'boards' {
  if (type === 'journal') return 'journals'
  if (type === 'docs') return 'docs'
  return 'boards'
}

/** `.beacon` 초기화 여부 (서버 FS) */
export async function isBeaconAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/beacon/available', { cache: 'no-store' })
    if (!res.ok) return false
    const json = (await res.json()) as { available?: boolean }
    return Boolean(json.available)
  } catch {
    return false
  }
}

export async function loadBeaconCache<T>(type: StorageDataType): Promise<T | null> {
  const res = await fetch(`/api/beacon/folio?type=${beaconFileType(type)}`, {
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Beacon 로드 실패 (${res.status})`)
  const json = (await res.json()) as { data?: T }
  return (json.data ?? null) as T | null
}

export async function saveBeaconCache(type: StorageDataType, data: unknown): Promise<void> {
  const res = await fetch('/api/beacon/folio', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: beaconFileType(type), data }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Beacon 저장 실패 (${res.status})`)
  }
}

/**
 * 모드에 따라 저장.
 * - 항상 로컬을 먼저 영속화 (탭 종료·새로고침 대비)
 * - beacon/cloud: 원격은 최대 5초, 실패해도 로컬은 이미 반영됨
 */
export async function saveWithFallback(
  data: unknown,
  type: StorageDataType,
  options: {
    localSave: (data: unknown) => void | Promise<void>
    cloudSave?: (data: unknown) => Promise<void>
    /** 로컬 저장 후 원격에 보낼 최신 스냅샷 (기본: data) */
    resolveRemoteData?: () => unknown
  },
): Promise<SaveWithFallbackResult> {
  const mode = getStorageMode()

  // 1) 로컬 선행 — cloud/beacon 대기를 기다리지 않음
  await options.localSave(data)

  // IndexedDB 미러 (오프라인 복구용)
  if (typeof window !== 'undefined') {
    void import('@/lib/offline-sync').then(({ mirrorToIndexedDb, queueRemoteSync, isBrowserOffline }) => {
      void mirrorToIndexedDb(type, data)
      if (mode !== 'local' && isBrowserOffline()) {
        void queueRemoteSync(type, options.resolveRemoteData?.() ?? data, `${type} offline`)
      }
    })
  }

  if (mode === 'local') {
    return { mode, usedFallback: false }
  }

  // 오프라인이면 원격 시도 생략 · 큐에 적재됨
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { mode, usedFallback: true }
  }

  const remoteData = options.resolveRemoteData?.() ?? data

  if (mode === 'beacon') {
    try {
      await withTimeout(
        (async () => {
          const available = await isBeaconAvailable()
          if (!available) throw new Error('Beacon 미초기화')
          await saveBeaconCache(type, remoteData)
        })(),
        5000,
        'beacon-save',
      )
      return { mode, usedFallback: false }
    } catch {
      if (typeof window !== 'undefined') {
        void import('@/lib/offline-sync').then(({ queueRemoteSync }) =>
          queueRemoteSync(type, remoteData, `${type} beacon-fail`),
        )
      }
      return { mode, usedFallback: true }
    }
  }

  // cloud
  if (!options.cloudSave) {
    return { mode, usedFallback: true }
  }
  try {
    await withTimeout(options.cloudSave(remoteData), 5000, 'cloud-save')
    return { mode, usedFallback: false }
  } catch {
    if (typeof window !== 'undefined') {
      void import('@/lib/offline-sync').then(({ queueRemoteSync }) =>
        queueRemoteSync(type, remoteData, `${type} cloud-fail`),
      )
    }
    return { mode, usedFallback: true }
  }
}

/**
 * 모드에 따라 로드.
 * - beacon: 캐시 있으면 사용, 없으면 local
 * - cloud: cloud 시도 → 실패 시 local
 * - local: local
 */
export async function loadWithFallback<T>(options: {
  type: StorageDataType
  localLoad: () => T
  cloudLoad?: () => Promise<T>
  /** beacon 캐시가 비었을 때 기본값 (보통 localLoad 결과) */
  emptyBeacon?: T
}): Promise<T> {
  const mode = getStorageMode()
  const local = options.localLoad()

  if (mode === 'local') return local

  if (mode === 'beacon') {
    try {
      const available = await isBeaconAvailable()
      if (!available) return local
      const data = await loadBeaconCache<T>(options.type)
      if (data == null) return options.emptyBeacon ?? local
      return data
    } catch {
      return local
    }
  }

  if (!options.cloudLoad) return local
  try {
    return await options.cloudLoad()
  } catch {
    return local
  }
}
