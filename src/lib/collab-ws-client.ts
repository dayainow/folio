/**
 * P48 — Collab WebSocket 클라이언트 (재연결 · 풀 · throttle)
 */
'use client'

import {
  decodeEnvelope,
  encodeEnvelope,
  type CollabChatMessage,
  type CollabWsEnvelope,
  type WebRtcSignal,
  type WhiteboardStroke,
} from '@/lib/collab-protocol'
import {
  awarenessThrottleMs,
  compressNumberArray,
  decompressNumberArray,
  shouldCompressUpdates,
  throttle,
  yjsThrottleMs,
} from '@/lib/collab-perf'
import { getCollabWsUrl } from '@/lib/collab-mode'

export type CollabWsClientHandlers = {
  onYjs?: (update: number[]) => void
  onAwareness?: (update: number[]) => void
  onChat?: (message: CollabChatMessage) => void
  onWhiteboard?: (stroke: WhiteboardStroke) => void
  onWhiteboardClear?: () => void
  onSignal?: (signal: WebRtcSignal) => void
  onStatus?: (status: 'connecting' | 'open' | 'closed' | 'error') => void
  onPeers?: (peers: string[]) => void
}

export type CollabWsClient = {
  ready: () => boolean
  sendYjs: (update: number[]) => void
  sendAwareness: (update: number[]) => void
  sendChat: (message: CollabChatMessage) => void
  sendWhiteboard: (stroke: WhiteboardStroke) => void
  clearWhiteboard: () => void
  sendSignal: (signal: WebRtcSignal) => void
  destroy: () => void
}

const pools = new Map<string, { ws: WebSocket; refs: number; rooms: Set<string> }>()

function poolKey(url: string): string {
  return url.replace(/\/$/, '')
}

export function createCollabWsClient(options: {
  roomId: string
  clientId: string
  user?: { id: string; name: string }
  url?: string
  handlers?: CollabWsClientHandlers
}): CollabWsClient {
  const urlBase = (options.url ?? getCollabWsUrl()).replace(/\/$/, '')
  const url = urlBase.includes('/collab') ? urlBase : `${urlBase}/collab`
  const key = poolKey(url)
  const handlers = options.handlers ?? {}

  let closed = false
  let attempt = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let socket: WebSocket | null = null

  const send = (msg: CollabWsEnvelope) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    try {
      socket.send(encodeEnvelope(msg))
    } catch {
      /* ignore */
    }
  }

  const join = () => {
    send({
      v: 1,
      type: 'join',
      room: options.roomId,
      clientId: options.clientId,
      user: options.user,
    })
  }

  const attach = (ws: WebSocket) => {
    socket = ws
    handlers.onStatus?.('open')
    attempt = 0
    join()

    if (pingTimer) clearInterval(pingTimer)
    pingTimer = setInterval(() => send({ v: 1, type: 'ping' }), 25_000)

    ws.addEventListener('message', onMessage)
  }

  const onMessage = (ev: MessageEvent) => {
    const raw = typeof ev.data === 'string' ? ev.data : ''
    const msg = decodeEnvelope(raw)
    if (!msg) return
    if (msg.type === 'yjs' && msg.room === options.roomId) {
      handlers.onYjs?.(decompressNumberArray(msg.update, msg.compressed))
    }
    if (msg.type === 'awareness' && msg.room === options.roomId) {
      handlers.onAwareness?.(msg.update)
    }
    if (msg.type === 'chat' && msg.room === options.roomId) {
      handlers.onChat?.(msg.message)
    }
    if (msg.type === 'whiteboard' && msg.room === options.roomId) {
      handlers.onWhiteboard?.(msg.stroke)
    }
    if (msg.type === 'whiteboard-clear' && msg.room === options.roomId) {
      handlers.onWhiteboardClear?.()
    }
    if (msg.type === 'signal' && msg.room === options.roomId) {
      handlers.onSignal?.(msg.signal)
    }
    if (msg.type === 'room-state' && msg.room === options.roomId) {
      handlers.onPeers?.(msg.peers)
      if (msg.persisted?.length) handlers.onYjs?.(msg.persisted)
    }
  }

  const connect = () => {
    if (closed) return
    handlers.onStatus?.('connecting')

    const existing = pools.get(key)
    if (existing && existing.ws.readyState === WebSocket.OPEN) {
      existing.refs += 1
      existing.rooms.add(options.roomId)
      attach(existing.ws)
      return
    }

    try {
      const ws = new WebSocket(url)
      pools.set(key, { ws, refs: 1, rooms: new Set([options.roomId]) })

      ws.addEventListener('open', () => attach(ws))
      ws.addEventListener('close', () => {
        handlers.onStatus?.('closed')
        pools.delete(key)
        socket = null
        if (pingTimer) {
          clearInterval(pingTimer)
          pingTimer = null
        }
        scheduleReconnect()
      })
      ws.addEventListener('error', () => {
        handlers.onStatus?.('error')
      })
    } catch {
      handlers.onStatus?.('error')
      scheduleReconnect()
    }
  }

  const scheduleReconnect = () => {
    if (closed) return
    const delay = Math.min(10_000, 500 * 2 ** Math.min(attempt, 5))
    attempt += 1
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = setTimeout(connect, delay)
  }

  connect()

  const sendYjsRaw = (update: number[]) => {
    const packed = shouldCompressUpdates()
      ? compressNumberArray(update)
      : { data: update, compressed: false }
    send({
      v: 1,
      type: 'yjs',
      room: options.roomId,
      update: packed.data,
      compressed: packed.compressed || undefined,
    })
  }

  const sendAwarenessRaw = (update: number[]) => {
    send({ v: 1, type: 'awareness', room: options.roomId, update })
  }

  const sendYjs = throttle(sendYjsRaw, yjsThrottleMs())
  const sendAwareness = throttle(sendAwarenessRaw, awarenessThrottleMs())

  return {
    ready: () => Boolean(socket && socket.readyState === WebSocket.OPEN),
    sendYjs,
    sendAwareness,
    sendChat(message) {
      send({ v: 1, type: 'chat', room: options.roomId, message })
    },
    sendWhiteboard(stroke) {
      send({ v: 1, type: 'whiteboard', room: options.roomId, stroke })
    },
    clearWhiteboard() {
      send({ v: 1, type: 'whiteboard-clear', room: options.roomId })
    },
    sendSignal(signal) {
      send({ v: 1, type: 'signal', room: options.roomId, signal })
    },
    destroy() {
      closed = true
      if (retryTimer) clearTimeout(retryTimer)
      if (pingTimer) clearInterval(pingTimer)
      send({ v: 1, type: 'leave', room: options.roomId, clientId: options.clientId })
      const pooled = pools.get(key)
      if (pooled) {
        pooled.refs -= 1
        pooled.rooms.delete(options.roomId)
        if (pooled.refs <= 0) {
          pools.delete(key)
          try {
            pooled.ws.close()
          } catch {
            /* ignore */
          }
        }
      }
      if (socket) {
        socket.removeEventListener('message', onMessage)
      }
      socket = null
    },
  }
}
