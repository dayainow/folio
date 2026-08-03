/**
 * P48 — Folio Collab WebSocket 서버
 * yjs / awareness / chat / whiteboard / WebRTC signaling
 */

import { createServer, type Server as HttpServer } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import {
  decodeEnvelope,
  encodeEnvelope,
  type CollabWsEnvelope,
} from '@/lib/collab-protocol'
import { createPubSubFromEnv, type PubSub } from '@/server/collab/pubsub'
import { RoomRegistry } from '@/server/collab/room'

export type CollabServerOptions = {
  port?: number
  host?: string
  /** 서버 사이드 Yjs 버퍼 persist (기본 true) */
  persist?: boolean
  path?: string
}

export type CollabServerHandle = {
  httpServer: HttpServer
  wss: WebSocketServer
  port: number
  host: string
  backend: 'memory' | 'redis'
  close: () => Promise<void>
  stats: () => { rooms: number; peers: number }
}

type ClientState = {
  id: string
  rooms: Set<string>
  socket: WebSocket
}

function safeSend(ws: WebSocket, msg: CollabWsEnvelope): void {
  if (ws.readyState !== ws.OPEN) return
  try {
    ws.send(encodeEnvelope(msg))
  } catch {
    /* ignore */
  }
}

export async function startCollabServer(
  options: CollabServerOptions = {},
): Promise<CollabServerHandle> {
  const port = options.port ?? Number(process.env.COLLAB_WS_PORT ?? 1234)
  const host = options.host ?? process.env.COLLAB_WS_HOST ?? '0.0.0.0'
  const persist = options.persist !== false
  const path = options.path ?? '/collab'

  const { pubsub, backend } = await createPubSubFromEnv()
  const registry = new RoomRegistry()
  const clients = new Map<WebSocket, ClientState>()
  const unsubs: Array<() => void> = []

  const httpServer = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/collab/health') {
      const s = registry.stats()
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          status: 'ok',
          service: 'folio-collab',
          backend,
          ...s,
          timestamp: new Date().toISOString(),
        }),
      )
      return
    }
    res.writeHead(404)
    res.end('not found')
  })

  const wss = new WebSocketServer({ server: httpServer, path })

  const broadcastRoom = (roomId: string, msg: CollabWsEnvelope, except?: string) => {
    const room = registry.get(roomId)
    if (!room) return
    const raw = encodeEnvelope(msg)
    room.forEachPeer((peer) => {
      if (except && peer.clientId === except) return
      if (peer.socket.readyState === peer.socket.OPEN) {
        try {
          peer.socket.send(raw)
        } catch {
          /* ignore */
        }
      }
    })
  }

  const ensurePubSub = (roomId: string) => {
    const channel = `folio:collab:${roomId}`
    const unsub = pubsub.subscribe(channel, (_ch, message) => {
      try {
        const env = decodeEnvelope(message)
        if (!env) return
        // 다른 인스턴스에서 온 메시지 — 로컬 소켓에 전달
        if (env.type === 'yjs' || env.type === 'awareness' || env.type === 'chat' || env.type === 'whiteboard' || env.type === 'whiteboard-clear' || env.type === 'signal') {
          broadcastRoom(roomId, env)
        }
      } catch {
        /* ignore */
      }
    })
    unsubs.push(unsub)
  }

  const publishFanout = async (roomId: string, msg: CollabWsEnvelope) => {
    await pubsub.publish(`folio:collab:${roomId}`, encodeEnvelope(msg))
  }

  wss.on('connection', (socket) => {
    const clientId = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const state: ClientState = { id: clientId, rooms: new Set(), socket }
    clients.set(socket, state)

    socket.on('message', (data) => {
      const raw = typeof data === 'string' ? data : data.toString('utf8')
      const msg = decodeEnvelope(raw)
      if (!msg) {
        safeSend(socket, { v: 1, type: 'error', message: 'invalid envelope' })
        return
      }

      void handleMessage(state, msg, {
        registry,
        persist,
        broadcastRoom,
        ensurePubSub,
        publishFanout,
        pubsub,
      })
    })

    socket.on('close', () => {
      for (const roomId of state.rooms) {
        const room = registry.get(roomId)
        room?.removePeer(clientId)
        broadcastRoom(roomId, { v: 1, type: 'leave', room: roomId, clientId })
        registry.deleteIfEmpty(roomId)
      }
      clients.delete(socket)
    })

    socket.on('error', () => {
      try {
        socket.close()
      } catch {
        /* ignore */
      }
    })
  })

  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => resolve())
  })

  return {
    httpServer,
    wss,
    port,
    host,
    backend,
    stats: () => registry.stats(),
    async close() {
      for (const u of unsubs) u()
      await new Promise<void>((resolve) => wss.close(() => resolve()))
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()))
      })
      await pubsub.close()
    },
  }
}

async function handleMessage(
  state: ClientState,
  msg: CollabWsEnvelope,
  ctx: {
    registry: RoomRegistry
    persist: boolean
    broadcastRoom: (roomId: string, msg: CollabWsEnvelope, except?: string) => void
    ensurePubSub: (roomId: string) => void
    publishFanout: (roomId: string, msg: CollabWsEnvelope) => Promise<void>
    pubsub: PubSub
  },
): Promise<void> {
  const { socket, id: clientId } = state

  if (msg.type === 'ping') {
    safeSend(socket, { v: 1, type: 'pong', ts: Date.now() })
    return
  }

  if (msg.type === 'join') {
    const room = ctx.registry.getOrCreate(msg.room)
    ctx.ensurePubSub(msg.room)
    room.addPeer({
      clientId,
      userId: msg.user?.id,
      userName: msg.user?.name,
      socket,
    })
    state.rooms.add(msg.room)
    safeSend(socket, {
      v: 1,
      type: 'room-state',
      room: msg.room,
      peers: room.listPeerIds(),
      persisted: ctx.persist ? room.persistedHint() : undefined,
    })
    // 최근 채팅/스트로크 재전송
    for (const chat of room.listChat()) {
      safeSend(socket, { v: 1, type: 'chat', room: msg.room, message: chat })
    }
    for (const stroke of room.listStrokes()) {
      safeSend(socket, { v: 1, type: 'whiteboard', room: msg.room, stroke })
    }
    if (ctx.persist) {
      for (const update of room.getYjsBuffers()) {
        safeSend(socket, { v: 1, type: 'yjs', room: msg.room, update })
      }
    }
    ctx.broadcastRoom(msg.room, { v: 1, type: 'join', room: msg.room, clientId, user: msg.user }, clientId)
    return
  }

  if (msg.type === 'leave') {
    const room = ctx.registry.get(msg.room)
    room?.removePeer(clientId)
    state.rooms.delete(msg.room)
    ctx.broadcastRoom(msg.room, { v: 1, type: 'leave', room: msg.room, clientId })
    ctx.registry.deleteIfEmpty(msg.room)
    return
  }

  if (msg.type === 'yjs') {
    const room = ctx.registry.get(msg.room)
    if (ctx.persist && room) room.pushYjsUpdate(msg.update)
    ctx.broadcastRoom(msg.room, msg, clientId)
    await ctx.publishFanout(msg.room, msg)
    return
  }

  if (msg.type === 'awareness') {
    ctx.broadcastRoom(msg.room, msg, clientId)
    await ctx.publishFanout(msg.room, msg)
    return
  }

  if (msg.type === 'chat') {
    const room = ctx.registry.get(msg.room)
    room?.pushChat(msg.message)
    ctx.broadcastRoom(msg.room, msg)
    await ctx.publishFanout(msg.room, msg)
    return
  }

  if (msg.type === 'whiteboard') {
    const room = ctx.registry.get(msg.room)
    room?.pushStroke(msg.stroke)
    ctx.broadcastRoom(msg.room, msg, clientId)
    await ctx.publishFanout(msg.room, msg)
    return
  }

  if (msg.type === 'whiteboard-clear') {
    ctx.registry.get(msg.room)?.clearStrokes()
    ctx.broadcastRoom(msg.room, msg)
    await ctx.publishFanout(msg.room, msg)
    return
  }

  if (msg.type === 'signal') {
    // WebRTC 시그널링 — 대상 peer 또는 룸 전체(*)
    const room = ctx.registry.get(msg.room)
    if (!room) return
    if (msg.signal.to === '*') {
      ctx.broadcastRoom(msg.room, msg, clientId)
    } else {
      const peer = room.getPeer(msg.signal.to)
      if (peer) safeSend(peer.socket, msg)
    }
    return
  }
}
