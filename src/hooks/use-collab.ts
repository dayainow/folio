/**
 * P41 — Collab 훅 (Presence + Yjs 텍스트 세션)
 */
'use client'

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  getOrCreateGuestId,
  joinPresenceRoom,
  type PresenceCursor,
  type PresenceUser,
} from '@/lib/presence'
import { createCollabSession, type CollabSession } from '@/lib/collab-yjs'
import { createBrowserSupabaseClient } from '@/lib/supabase'

export type CollabIdentity = {
  userId: string
  name: string
  email?: string | null
  color?: string
}

async function resolveIdentity(): Promise<CollabIdentity> {
  try {
    const supabase = createBrowserSupabaseClient()
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (user) {
      const email = user.email ?? null
      const name =
        (user.user_metadata?.full_name as string | undefined) ||
        email?.split('@')[0] ||
        'User'
      return { userId: user.id, name, email }
    }
  } catch {
    /* local guest */
  }
  const guestId = getOrCreateGuestId()
  return { userId: guestId, name: 'Guest', email: null }
}

/** 룸 Presence — 피어 아바타용 */
export function usePresence(roomId: string | null, tab?: string) {
  const [peers, setPeers] = useState<PresenceUser[]>([])
  const [self, setSelf] = useState<CollabIdentity | null>(null)
  const [transport, setTransport] = useState<'supabase' | 'broadcast' | null>(null)
  const updateRef = useRef<((patch: Partial<Pick<PresenceUser, 'cursor' | 'tab' | 'name'>>) => void) | null>(
    null,
  )

  useEffect(() => {
    if (!roomId) {
      updateRef.current = null
      return () => undefined
    }
    let cancelled = false
    let leave: (() => void) | undefined

    void resolveIdentity().then((identity) => {
      if (cancelled) return
      setSelf(identity)
      const session = joinPresenceRoom({
        roomId,
        self: {
          userId: identity.userId,
          name: identity.name,
          email: identity.email,
          tab,
        },
        onPeers: (next) => {
          if (!cancelled) setPeers(next)
        },
      })
      updateRef.current = session.updateMeta
      setTransport(session.transport)
      leave = session.leave
    })

    return () => {
      cancelled = true
      leave?.()
      updateRef.current = null
    }
  }, [roomId, tab])

  const updateCursor = useCallback((cursor: PresenceCursor | null) => {
    updateRef.current?.({ cursor })
  }, [])

  const visiblePeers = roomId ? peers : []
  const visibleTransport = roomId ? transport : null

  return { peers: visiblePeers, self, transport: visibleTransport, updateCursor }
}

/**
 * Yjs 기반 동시 편집 — value를 CRDT에 미러링하고 원격 변경을 콜백.
 * MVP: 전체 문자열 setText (충돌은 Yjs가 병합).
 */
export function useCollabText(options: {
  roomId: string | null
  enabled?: boolean
  value: string
  onRemoteChange: (text: string) => void
}) {
  const { roomId, enabled = true, value, onRemoteChange } = options
  const sessionRef = useRef<CollabSession | null>(null)
  const applyingRemote = useRef(false)
  const [transport, setTransport] = useState<CollabSession['transport'] | null>(null)
  const onRemote = useEffectEvent((text: string) => {
    onRemoteChange(text)
  })

  useEffect(() => {
    if (!roomId || !enabled) {
      sessionRef.current?.destroy()
      sessionRef.current = null
      return () => undefined
    }

    let cancelled = false
    let unobserve: (() => void) | undefined

    void resolveIdentity().then((identity) => {
      if (cancelled) return
      sessionRef.current?.destroy()
      const session = createCollabSession({
        roomId,
        userId: identity.userId,
        userName: identity.name,
        initialText: value,
      })
      sessionRef.current = session
      setTransport(session.transport)

      unobserve = session.observeText((text, origin) => {
        if (origin !== 'remote') return
        applyingRemote.current = true
        onRemote(text)
        queueMicrotask(() => {
          applyingRemote.current = false
        })
      })
    })

    return () => {
      cancelled = true
      unobserve?.()
      sessionRef.current?.destroy()
      sessionRef.current = null
    }
    // room/enabled만 — value 초기 seed는 세션 생성 시 1회
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, enabled])

  useEffect(() => {
    if (applyingRemote.current) return
    sessionRef.current?.setText(value)
  }, [value])

  return { transport: roomId && enabled ? transport : null }
}
