/**
 * P41/P43/P45/P48 — Yjs CRDT 실시간 동시 편집
 * · 공통 prefix/suffix 구간 치환으로 충돌 면적 축소
 * · UndoManager 되돌리기/다시 실행
 * · 원격 병합 시 이력 스냅샷 (UI: CollabHistoryPanel)
 * · P48: collab mode — local(BC) · server(WS) · hybrid(WS+BC)
 * · Supabase Realtime은 local에서 기존처럼 우선 시도(호환)
 */
'use client'

import * as Y from 'yjs'
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { findReplaceRange } from '@/lib/collab-history'
import { getCollabMode, type CollabMode } from '@/lib/collab-mode'
import type { CollabWsClient } from '@/lib/collab-ws-client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type CollabTransport = 'supabase' | 'broadcast' | 'websocket' | 'hybrid' | 'local'

export type CollabSession = {
  doc: Y.Doc
  awareness: Awareness
  ytext: Y.Text
  undoManager: Y.UndoManager
  observeText: (cb: (text: string, origin: 'local' | 'remote') => void) => () => void
  setText: (next: string) => void
  getText: () => string
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  destroy: () => void
  transport: CollabTransport
  mode: CollabMode
}

function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('placeholder') &&
      !String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('example.supabase'),
  )
}

function toArray(u8: Uint8Array): number[] {
  return Array.from(u8)
}

function fromArray(arr: number[]): Uint8Array {
  return new Uint8Array(arr)
}

/**
 * roomId 예: `journal:2026-08-02` · `doc:<uuid>`
 * initialText는 Y.Text가 비어 있을 때만 seed.
 */
export function createCollabSession(options: {
  roomId: string
  userId: string
  userName: string
  color?: string
  initialText?: string
  /** 미지정 시 getCollabMode() */
  mode?: CollabMode
}): CollabSession {
  const {
    roomId,
    userId,
    userName,
    color = '#0d9488',
    initialText = '',
    mode = getCollabMode(),
  } = options
  const doc = new Y.Doc()
  const awareness = new Awareness(doc)
  const ytext = doc.getText('content')
  const undoManager = new Y.UndoManager(ytext, {
    trackedOrigins: new Set(['local-set', null]),
    captureTimeout: 400,
  })

  awareness.setLocalStateField('user', { userId, name: userName, color })

  if (ytext.length === 0 && initialText) {
    ytext.insert(0, initialText)
  }

  let transport: CollabTransport = 'local'
  let channel: RealtimeChannel | null = null
  let bc: BroadcastChannel | null = null
  let wsClient: CollabWsClient | null = null
  const remoteOrigin = 'remote'

  const useWs = mode === 'server' || mode === 'hybrid'
  const useBc = mode === 'local' || mode === 'hybrid'
  const useSupabase = mode === 'local' && hasSupabaseEnv()

  const broadcastUpdate = (update: Uint8Array) => {
    const payload = { update: toArray(update) }
    if (channel) {
      void channel.send({
        type: 'broadcast',
        event: 'yjs',
        payload,
      })
    }
    bc?.postMessage({ type: 'yjs', ...payload })
    wsClient?.sendYjs(payload.update)
  }

  const broadcastAwareness = (changedClients: number[]) => {
    const update = encodeAwarenessUpdate(awareness, changedClients)
    const payload = { update: toArray(update) }
    if (channel) {
      void channel.send({ type: 'broadcast', event: 'awareness', payload })
    }
    bc?.postMessage({ type: 'awareness', ...payload })
    wsClient?.sendAwareness(payload.update)
  }

  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === remoteOrigin) return
    broadcastUpdate(update)
  }
  doc.on('update', onDocUpdate)

  awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
    const changed = added.concat(updated, removed)
    if (changed.length) broadcastAwareness(changed)
  })

  const applyRemoteYjs = (arr: number[]) => {
    try {
      Y.applyUpdate(doc, fromArray(arr), remoteOrigin)
    } catch {
      /* ignore malformed */
    }
  }

  const applyRemoteAwareness = (arr: number[]) => {
    try {
      applyAwarenessUpdate(awareness, fromArray(arr), remoteOrigin)
    } catch {
      /* ignore */
    }
  }

  if (useSupabase) {
    try {
      const supabase = createBrowserSupabaseClient()
      channel = supabase.channel(`yjs:${roomId}`, {
        config: { broadcast: { self: false } },
      })
      channel
        .on('broadcast', { event: 'yjs' }, ({ payload }) => {
          if (payload?.update) applyRemoteYjs(payload.update as number[])
        })
        .on('broadcast', { event: 'awareness' }, ({ payload }) => {
          if (payload?.update) applyRemoteAwareness(payload.update as number[])
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            transport = 'supabase'
            broadcastUpdate(Y.encodeStateAsUpdate(doc))
            broadcastAwareness([doc.clientID])
          }
        })
    } catch {
      channel = null
    }
  }

  if (useBc && typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel(`folio-yjs:${roomId}`)
    if (!channel && !useWs) transport = 'broadcast'
    bc.onmessage = (ev) => {
      const data = ev.data as { type?: string; update?: number[] }
      if (data?.type === 'yjs' && data.update) applyRemoteYjs(data.update)
      if (data?.type === 'awareness' && data.update) applyRemoteAwareness(data.update)
      if (data?.type === 'hello') {
        broadcastUpdate(Y.encodeStateAsUpdate(doc))
        broadcastAwareness([doc.clientID])
      }
    }
    bc.postMessage({ type: 'hello' })
    if (!useWs) broadcastUpdate(Y.encodeStateAsUpdate(doc))
  }

  if (useWs && typeof window !== 'undefined') {
    // 동적 import로 서버 번들 분리 부담 감소
    void import('@/lib/collab-ws-client').then(({ createCollabWsClient }) => {
      if (wsClient) return
      wsClient = createCollabWsClient({
        roomId,
        clientId: `${userId}-${doc.clientID}`,
        user: { id: userId, name: userName },
        handlers: {
          onYjs: applyRemoteYjs,
          onAwareness: applyRemoteAwareness,
          onStatus: (s) => {
            if (s === 'open') {
              transport = mode === 'hybrid' ? 'hybrid' : 'websocket'
              broadcastUpdate(Y.encodeStateAsUpdate(doc))
              broadcastAwareness([doc.clientID])
            }
          },
        },
      })
      if (mode === 'server') transport = 'websocket'
      if (mode === 'hybrid') transport = bc ? 'hybrid' : 'websocket'
    })
  }

  if (!channel && !bc && !useWs) {
    transport = 'local'
  }

  return {
    doc,
    awareness,
    ytext,
    undoManager,
    transport,
    mode,
    getText: () => ytext.toString(),
    setText(next: string) {
      const cur = ytext.toString()
      const range = findReplaceRange(cur, next)
      if (!range) return
      doc.transact(() => {
        if (range.deleteLen > 0) ytext.delete(range.start, range.deleteLen)
        if (range.insert) ytext.insert(range.start, range.insert)
      }, 'local-set')
    },
    undo() {
      undoManager.undo()
    },
    redo() {
      undoManager.redo()
    },
    canUndo() {
      return undoManager.canUndo()
    },
    canRedo() {
      return undoManager.canRedo()
    },
    observeText(cb) {
      const handler = (_: Y.YTextEvent, tr: Y.Transaction) => {
        const origin = tr.origin === remoteOrigin ? 'remote' : 'local'
        cb(ytext.toString(), origin)
      }
      ytext.observe(handler)
      return () => ytext.unobserve(handler)
    },
    destroy() {
      doc.off('update', onDocUpdate)
      undoManager.destroy()
      removeAwarenessStates(awareness, [doc.clientID], 'local')
      awareness.destroy()
      void channel?.unsubscribe()
      bc?.close()
      wsClient?.destroy()
      wsClient = null
      doc.destroy()
    },
  }
}
