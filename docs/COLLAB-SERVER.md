# Folio Collab Server

P48 — 협업 서버 옵션 (WebSocket · Room · Yjs · 채팅 · 화이트보드 · WebRTC 시그널링)

## 모드

| 모드 | 동작 |
|------|------|
| **local** | BroadcastChannel (+ 기존 Supabase Realtime 우선) |
| **server** | Folio Collab WebSocket만 |
| **hybrid** | WebSocket + BroadcastChannel 병행 (오프라인→온라인) |

UI: 사이드바 **협업 · …** 토글 또는 협업 패널 헤더.

## 실행

```bash
# 터미널 1 — Collab WS
npm run collab:server
# → ws://127.0.0.1:1234/collab · GET http://127.0.0.1:1234/health

# 터미널 2 — Next.js
npm run dev
```

환경변수:

| 키 | 기본 | 설명 |
|----|------|------|
| `COLLAB_WS_PORT` | `1234` | 서버 포트 |
| `COLLAB_WS_HOST` | `0.0.0.0` | 바인드 주소 |
| `NEXT_PUBLIC_COLLAB_WS_URL` | `ws://localhost:1234` | 클라이언트 기본 URL |
| `REDIS_URL` | — | 멀티 인스턴스용 (현재 memory 안내, 어댑터 확장 포인트) |

## 배포

- Next.js(Vercel)와 **별도 프로세스**로 실행 (WebSocket은 서버리스에 부적합).
- Docker Compose 예: `folio` 앱 + `collab` 서비스 (`npm run collab:server`).
- 리버스 프록시: `/collab` → WS 업그레이드, `/health` 헬스체크.

## Persist

서버는 룸별 최근 Yjs update 버퍼·채팅·화이트보드 스트로크를 메모리에 보관합니다.  
영구 저장이 필요하면 Supabase 테이블 또는 Redis에 `CollabRoom` 버퍼를 스냅샷하세요.

## 부하 스모크

```bash
npm run collab:server &
npm run collab:load          # 기본 100 동시 연결
COLLAB_LOAD_N=50 npm run collab:load
```

상세 프로토콜: [WEBSOCKET.md](./WEBSOCKET.md) · 충돌: [CONFLICT-RESOLUTION.md](./CONFLICT-RESOLUTION.md)
