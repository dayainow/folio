/**
 * P41 — Presence (접속 중인 사용자 · 커서/선택 영역 공유)
 * Supabase Realtime Presence 우선, 미설정 시 BroadcastChannel 폴백.
 */
'use client'

import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type PresenceCursor = {
  /** textarea selectionStart */
  anchor: number
  /** textarea selectionEnd */
  head: number
}

/** P45 — 사용자 상태 표시기 */
export type PresenceStatus = 'online' | 'away' | 'busy'

export type PresenceUser = {
  userId: string
  name: string
  color: string
  email?: string | null
  tab?: string
  roomId: string
  cursor?: PresenceCursor | null
  /** P43 — 타이핑 중 */
  typing?: boolean
  /** P45 — 온라인/자리비움/다른용무 */
  status?: PresenceStatus
  updatedAt: string
}

export type PresenceUnsubscribe = () => void

const COLORS = ['#0d9488', '#2563eb', '#c026d3', '#ea580c', '#ca8a04', '#dc2626', '#4f46e5']

export function presenceColorFor(userId: string): string {
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]!
}

export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return 'guest-ssr'
  const key = 'folio_presence_guest_id'
  try {
    const existing = sessionStorage.getItem(key)
    if (existing) return existing
    const id = `guest-${crypto.randomUUID().slice(0, 8)}`
    sessionStorage.setItem(key, id)
    return id
  } catch {
    return `guest-${Math.random().toString(36).slice(2, 10)}`
  }
}

function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('example.supabase'),
  )
}

function peersFromMap(map: Map<string, PresenceUser>, selfId: string): PresenceUser[] {
  return [...map.values()]
    .filter((u) => u.userId !== selfId)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * 룸에 Presence를 등록하고 피어 목록 변경을 구독한다.
 * cursor는 optional — 선택 영역 공유용.
 */
export function joinPresenceRoom(options: {
  roomId: string
  self: Omit<PresenceUser, 'roomId' | 'updatedAt' | 'color'> & { color?: string }
  onPeers: (peers: PresenceUser[]) => void
}): {
  updateMeta: (patch: Partial<Pick<PresenceUser, 'cursor' | 'tab' | 'name' | 'typing' | 'status'>>) => void
  leave: PresenceUnsubscribe
  transport: 'supabase' | 'broadcast'
} {
  const { roomId, self, onPeers } = options
  const color = self.color ?? presenceColorFor(self.userId)
  const local = new Map<string, PresenceUser>()

  const snapshot = (): PresenceUser => ({
    userId: self.userId,
    name: self.name,
    email: self.email ?? null,
    color,
    tab: self.tab,
    roomId,
    cursor: self.cursor ?? null,
    typing: self.typing ?? false,
    status: self.status ?? 'online',
    updatedAt: new Date().toISOString(),
  })

  let current = snapshot()
  local.set(self.userId, current)

  const emit = () => onPeers(peersFromMap(local, self.userId))

  if (hasSupabaseEnv()) {
    let channel: RealtimeChannel | null = null
    try {
      const supabase = createBrowserSupabaseClient()
      channel = supabase.channel(`presence:${roomId}`, {
        config: { presence: { key: self.userId } },
      })

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel!.presenceState<PresenceUser>()
          local.clear()
          local.set(self.userId, current)
          for (const key of Object.keys(state)) {
            const rows = state[key]
            const row = Array.isArray(rows) ? rows[0] : rows
            if (row && typeof row === 'object' && 'userId' in row) {
              local.set(String((row as PresenceUser).userId), row as PresenceUser)
            }
          }
          emit()
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel!.track(current)
            emit()
          }
        })

      return {
        transport: 'supabase' as const,
        updateMeta(patch) {
          current = {
            ...current,
            ...patch,
            color,
            roomId,
            updatedAt: new Date().toISOString(),
          }
          local.set(self.userId, current)
          void channel?.track(current)
          emit()
        },
        leave() {
          void channel?.unsubscribe()
        },
      }
    } catch {
      // fall through to BroadcastChannel
    }
  }

  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`folio-presence:${roomId}`) : null
  const hello = () => {
    bc?.postMessage({ type: 'hello', user: current })
    bc?.postMessage({ type: 'sync', user: current })
  }

  const onMessage = (ev: MessageEvent) => {
    const data = ev.data as { type?: string; user?: PresenceUser; userId?: string }
    if (!data?.type) return
    if (data.type === 'sync' || data.type === 'hello' || data.type === 'update') {
      if (data.user && data.user.userId !== self.userId) {
        local.set(data.user.userId, data.user)
        if (data.type === 'hello') {
          bc?.postMessage({ type: 'sync', user: current })
        }
        emit()
      }
    }
    if (data.type === 'leave' && data.userId) {
      local.delete(data.userId)
      emit()
    }
  }
  bc?.addEventListener('message', onMessage)
  hello()
  emit()

  const heartbeat = window.setInterval(() => {
    current = { ...current, updatedAt: new Date().toISOString() }
    bc?.postMessage({ type: 'update', user: current })
  }, 15_000)

  return {
    transport: 'broadcast' as const,
    updateMeta(patch) {
      current = {
        ...current,
        ...patch,
        color,
        roomId,
        updatedAt: new Date().toISOString(),
      }
      local.set(self.userId, current)
      bc?.postMessage({ type: 'update', user: current })
      emit()
    },
    leave() {
      window.clearInterval(heartbeat)
      bc?.postMessage({ type: 'leave', userId: self.userId })
      bc?.removeEventListener('message', onMessage)
      bc?.close()
    },
  }
}
