/**
 * P48 — Collab Room: 피어 · Yjs persist 버퍼 · 채팅/화이트보드 최근 이력
 */

import type { CollabChatMessage, WhiteboardStroke } from '@/lib/collab-protocol'
import type { WebSocket } from 'ws'

export type RoomPeer = {
  clientId: string
  userId?: string
  userName?: string
  socket: WebSocket
}

export class CollabRoom {
  readonly id: string
  private peers = new Map<string, RoomPeer>()
  /** 최근 Yjs update 누적 (옵션 persist) */
  private yjsBuffer: number[][] = []
  private chat: CollabChatMessage[] = []
  private strokes: WhiteboardStroke[] = []
  private readonly maxChat = 100
  private readonly maxStrokes = 500
  private readonly maxYjsBuffers = 64

  constructor(id: string) {
    this.id = id
  }

  get size(): number {
    return this.peers.size
  }

  listPeerIds(): string[] {
    return [...this.peers.keys()]
  }

  addPeer(peer: RoomPeer): void {
    this.peers.set(peer.clientId, peer)
  }

  removePeer(clientId: string): RoomPeer | undefined {
    const p = this.peers.get(clientId)
    this.peers.delete(clientId)
    return p
  }

  getPeer(clientId: string): RoomPeer | undefined {
    return this.peers.get(clientId)
  }

  forEachPeer(fn: (peer: RoomPeer) => void, exceptClientId?: string): void {
    for (const [id, peer] of this.peers) {
      if (exceptClientId && id === exceptClientId) continue
      fn(peer)
    }
  }

  pushYjsUpdate(update: number[]): void {
    this.yjsBuffer.push(update)
    if (this.yjsBuffer.length > this.maxYjsBuffers) {
      this.yjsBuffer.splice(0, this.yjsBuffer.length - this.maxYjsBuffers)
    }
  }

  getYjsBuffers(): number[][] {
    return [...this.yjsBuffer]
  }

  /** 단일 concatenated 스냅샷이 없을 때 최근 업데이트 목록 길이만 노출 */
  persistedHint(): number[] | undefined {
    if (this.yjsBuffer.length === 0) return undefined
    return this.yjsBuffer[this.yjsBuffer.length - 1]
  }

  pushChat(msg: CollabChatMessage): void {
    this.chat.push(msg)
    if (this.chat.length > this.maxChat) this.chat.splice(0, this.chat.length - this.maxChat)
  }

  listChat(): CollabChatMessage[] {
    return [...this.chat]
  }

  pushStroke(stroke: WhiteboardStroke): void {
    this.strokes.push(stroke)
    if (this.strokes.length > this.maxStrokes) {
      this.strokes.splice(0, this.strokes.length - this.maxStrokes)
    }
  }

  clearStrokes(): void {
    this.strokes = []
  }

  listStrokes(): WhiteboardStroke[] {
    return [...this.strokes]
  }
}

export class RoomRegistry {
  private rooms = new Map<string, CollabRoom>()

  getOrCreate(roomId: string): CollabRoom {
    let room = this.rooms.get(roomId)
    if (!room) {
      room = new CollabRoom(roomId)
      this.rooms.set(roomId, room)
    }
    return room
  }

  get(roomId: string): CollabRoom | undefined {
    return this.rooms.get(roomId)
  }

  deleteIfEmpty(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (room && room.size === 0) this.rooms.delete(roomId)
  }

  stats(): { rooms: number; peers: number } {
    let peers = 0
    for (const r of this.rooms.values()) peers += r.size
    return { rooms: this.rooms.size, peers }
  }
}
