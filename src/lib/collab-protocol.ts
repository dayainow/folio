/**
 * P48 — Folio Collab WebSocket 프로토콜 (클라이언트·서버 공유)
 */

export type CollabWsEnvelope =
  | { v: 1; type: 'join'; room: string; clientId: string; user?: { id: string; name: string } }
  | { v: 1; type: 'leave'; room: string; clientId: string }
  | { v: 1; type: 'ping' }
  | { v: 1; type: 'pong'; ts: number }
  | { v: 1; type: 'yjs'; room: string; update: number[]; compressed?: boolean }
  | { v: 1; type: 'awareness'; room: string; update: number[] }
  | { v: 1; type: 'chat'; room: string; message: CollabChatMessage }
  | { v: 1; type: 'whiteboard'; room: string; stroke: WhiteboardStroke }
  | { v: 1; type: 'whiteboard-clear'; room: string }
  | { v: 1; type: 'signal'; room: string; signal: WebRtcSignal }
  | { v: 1; type: 'room-state'; room: string; peers: string[]; persisted?: number[] }
  | { v: 1; type: 'error'; message: string }

export type CollabChatMessage = {
  id: string
  userId: string
  userName: string
  text: string
  ts: string
}

export type WhiteboardStroke = {
  id: string
  userId: string
  color: string
  width: number
  points: Array<{ x: number; y: number }>
  ts: string
}

export type WebRtcSignal = {
  from: string
  to: string | '*'
  kind: 'offer' | 'answer' | 'ice' | 'hangup' | 'screen-offer' | 'screen-answer'
  payload?: unknown
}

export function encodeEnvelope(msg: CollabWsEnvelope): string {
  return JSON.stringify(msg)
}

export function decodeEnvelope(raw: string): CollabWsEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as CollabWsEnvelope
    if (!parsed || parsed.v !== 1 || typeof parsed.type !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

/** room 헬퍼: doc / journal / project */
export function docRoom(docId: string): string {
  return `doc:${docId}`
}

export function journalRoom(date: string): string {
  return `journal:${date}`
}

export function projectRoom(projectId: string): string {
  return `project:${projectId}`
}
