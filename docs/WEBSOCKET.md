# Folio Collab WebSocket 프로토콜

버전 `v: 1` JSON 텍스트 프레임. 경로: `/collab`

## Envelope

```ts
type Envelope =
  | { v: 1; type: 'join'; room: string; clientId: string; user?: { id: string; name: string } }
  | { v: 1; type: 'leave'; room: string; clientId: string }
  | { v: 1; type: 'ping' }
  | { v: 1; type: 'pong'; ts: number }
  | { v: 1; type: 'yjs'; room: string; update: number[]; compressed?: boolean }
  | { v: 1; type: 'awareness'; room: string; update: number[] }
  | { v: 1; type: 'chat'; room: string; message: ChatMessage }
  | { v: 1; type: 'whiteboard'; room: string; stroke: Stroke }
  | { v: 1; type: 'whiteboard-clear'; room: string }
  | { v: 1; type: 'signal'; room: string; signal: WebRtcSignal }
  | { v: 1; type: 'room-state'; room: string; peers: string[]; persisted?: number[] }
  | { v: 1; type: 'error'; message: string }
```

## Room 규칙

| 종류 | room id |
|------|---------|
| 문서 | `doc:<id>` |
| 일지 | `journal:<YYYY-MM-DD>` |
| 프로젝트 | `project:<id>` |
| 화이트보드 | `<room>:wb` (클라이언트 관례) |

## Yjs / Awareness

- `update`는 `Uint8Array`를 `number[]`로 인코딩한 Yjs binary update.
- `compressed: true`이면 RLE 압축 (`collab-perf`) — 수신 측 해제 후 `Y.applyUpdate`.
- Awareness는 `y-protocols/awareness` 인코딩.

## 채팅

```json
{
  "v": 1,
  "type": "chat",
  "room": "doc:123",
  "message": {
    "id": "uuid",
    "userId": "u1",
    "userName": "Ada",
    "text": "hello",
    "ts": "2026-08-03T12:00:00.000Z"
  }
}
```

## WebRTC 시그널링

`signal.kind`: `offer` | `answer` | `ice` | `hangup` | `screen-offer` | `screen-answer`  
`signal.to`: peer `clientId` 또는 `*` (룸 브로드캐스트).

## 재연결

클라이언트(`collab-ws-client`)는 지수 백오프 재연결 · 연결 풀링 · 25s ping을 사용합니다.
