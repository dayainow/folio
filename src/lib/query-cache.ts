const DEFAULT_TTL_MS = 5 * 60 * 1000

type CacheEntry = { at: number; data: unknown }

const store = new Map<string, CacheEntry>()

/** Supabase 등 비동기 조회 5분 TTL 캐시 */
export async function cachedQuery<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = store.get(key)
  if (hit && Date.now() - hit.at < ttlMs) {
    return hit.data as T
  }
  const data = await loader()
  store.set(key, { at: Date.now(), data })
  return data
}

export function invalidateQueryCache(prefix?: string): void {
  if (!prefix) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

export function peekQueryCache<T>(key: string): T | null {
  const hit = store.get(key)
  if (!hit) return null
  return hit.data as T
}
