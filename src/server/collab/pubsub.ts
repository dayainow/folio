/**
 * P48 — in-memory pub/sub (단일 인스턴스)
 * 멀티 인스턴스는 REDIS_URL + 외부 어댑터로 확장 (docs/COLLAB-SERVER.md)
 */

export type PubSubHandler = (channel: string, message: string) => void

export type PubSub = {
  publish: (channel: string, message: string) => Promise<void>
  subscribe: (channel: string, handler: PubSubHandler) => () => void
  close: () => Promise<void>
}

export function createMemoryPubSub(): PubSub {
  const handlers = new Map<string, Set<PubSubHandler>>()

  return {
    async publish(channel, message) {
      const set = handlers.get(channel)
      if (!set) return
      for (const h of set) {
        try {
          h(channel, message)
        } catch {
          /* ignore */
        }
      }
    },
    subscribe(channel, handler) {
      let set = handlers.get(channel)
      if (!set) {
        set = new Set()
        handlers.set(channel, set)
      }
      set.add(handler)
      return () => {
        set!.delete(handler)
        if (set!.size === 0) handlers.delete(channel)
      }
    },
    async close() {
      handlers.clear()
    },
  }
}

export async function createPubSubFromEnv(): Promise<{ pubsub: PubSub; backend: 'memory' | 'redis' }> {
  const url = process.env.REDIS_URL?.trim()
  if (url && !url.includes('your-') && !url.includes('placeholder')) {
    // Redis 클라이언트는 선택 의존성 — 미설치 시 memory
    console.warn(
      '[collab] REDIS_URL 설정됨. 멀티 인스턴스용 Redis 어댑터는 docs/COLLAB-SERVER.md 참고. 현재 memory pub/sub.',
    )
  }
  return { pubsub: createMemoryPubSub(), backend: 'memory' }
}
