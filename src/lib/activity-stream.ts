/**
 * P41 — 팀 활동 스트림 (저장/편집/댓글/태스크 완료)
 * localStorage + BroadcastChannel (+ Supabase Realtime broadcast 선택)
 */
'use client'

import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type ActivityType = 'save' | 'edit' | 'comment' | 'task_done' | 'presence' | 'other'

export type ActivityEvent = {
  id: string
  type: ActivityType
  actorId: string
  actorName: string
  targetKind?: 'doc' | 'journal' | 'board' | 'team' | string
  targetId?: string
  summary: string
  meta?: Record<string, unknown>
  createdAt: string
}

export type ActivityFilter = {
  actorId?: string
  targetKind?: string
  targetId?: string
  /** ISO — 이 시각 이후만 */
  since?: string
  types?: ActivityType[]
  limit?: number
}

const STORAGE_KEY = 'folio_activity_stream_v1'
const MAX_EVENTS = 200
const BC_NAME = 'folio-activity-stream'

function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('placeholder') &&
      !String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('example.supabase'),
  )
}

function readAll(): ActivityEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ActivityEvent[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(items: ActivityEvent[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_EVENTS)))
    window.dispatchEvent(new CustomEvent('folio-activity-changed'))
  } catch {
    /* ignore */
  }
}

export function listActivity(filter: ActivityFilter = {}): ActivityEvent[] {
  let items = readAll()
  if (filter.actorId) items = items.filter((e) => e.actorId === filter.actorId)
  if (filter.targetKind) items = items.filter((e) => e.targetKind === filter.targetKind)
  if (filter.targetId) items = items.filter((e) => e.targetId === filter.targetId)
  if (filter.since) items = items.filter((e) => e.createdAt >= filter.since!)
  if (filter.types?.length) {
    const set = new Set(filter.types)
    items = items.filter((e) => set.has(e.type))
  }
  items = items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const limit = filter.limit ?? 50
  return items.slice(0, limit)
}

function fanOut(event: ActivityEvent) {
  if (typeof window === 'undefined') return
  try {
    const bc = new BroadcastChannel(BC_NAME)
    bc.postMessage({ type: 'activity', event })
    bc.close()
  } catch {
    /* ignore */
  }

  if (!hasSupabaseEnv()) return
  try {
    const supabase = createBrowserSupabaseClient()
    const channel = supabase.channel('activity:team', {
      config: { broadcast: { self: false } },
    })
    void channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.send({ type: 'broadcast', event: 'activity', payload: { event } }).finally(() => {
          void channel.unsubscribe()
        })
      }
    })
  } catch {
    /* ignore */
  }
}

export async function publishActivity(
  input: Omit<ActivityEvent, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): Promise<ActivityEvent> {
  const event: ActivityEvent = {
    id: input.id ?? crypto.randomUUID(),
    type: input.type,
    actorId: input.actorId,
    actorName: input.actorName,
    targetKind: input.targetKind,
    targetId: input.targetId,
    summary: input.summary,
    meta: input.meta,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }

  const all = readAll()
  if (all.some((e) => e.id === event.id)) return event
  writeAll([event, ...all])
  fanOut(event)
  return event
}

export function subscribeActivity(cb: (events: ActivityEvent[]) => void): () => void {
  if (typeof window === 'undefined') return () => undefined

  const emit = () => cb(listActivity({ limit: 80 }))
  const onLocal = () => emit()
  window.addEventListener('folio-activity-changed', onLocal)
  window.addEventListener('storage', onLocal)

  let bc: BroadcastChannel | null = null
  try {
    bc = new BroadcastChannel(BC_NAME)
    bc.onmessage = (ev) => {
      const data = ev.data as { type?: string; event?: ActivityEvent }
      if (data?.type === 'activity' && data.event) {
        const all = readAll()
        if (!all.some((e) => e.id === data.event!.id)) {
          writeAll([data.event, ...all])
        } else {
          emit()
        }
      }
    }
  } catch {
    bc = null
  }

  let channel: RealtimeChannel | null = null
  if (hasSupabaseEnv()) {
    try {
      const supabase = createBrowserSupabaseClient()
      channel = supabase.channel('activity:team', {
        config: { broadcast: { self: false } },
      })
      channel
        .on('broadcast', { event: 'activity' }, ({ payload }) => {
          const event = (payload as { event?: ActivityEvent })?.event
          if (!event?.id) return
          const all = readAll()
          if (!all.some((e) => e.id === event.id)) writeAll([event, ...all])
        })
        .subscribe()
    } catch {
      channel = null
    }
  }

  emit()

  return () => {
    window.removeEventListener('folio-activity-changed', onLocal)
    window.removeEventListener('storage', onLocal)
    bc?.close()
    void channel?.unsubscribe()
  }
}

export function clearActivity() {
  writeAll([])
}
