# Folio

![Dashboard](screenshots/dashboard.png)

**프로젝트의 기록, 한 곳에서.** · **v2.2.0-wip**

Folio는 개발자의 일지·문서·일정·프로세스를 하나로 묶는 워크스페이스입니다.
Obsidian으로 메모하고, Notion으로 문서를 관리하고, Jira로 일정을 tracking하는 흐름을,
**한 화면에서**, **한 도구에서** 끝낼 수 있습니다.

---

## 왜 Folio인가?

| 도구 | 역할 |
|------|------|
| **Obsidian** | 개인 메모, 생각 정리, 지식 그래프 |
| **Notion** | 팀 공통 문서, 정책, 가이드 |
| **Jira** | 프로젝트 일정, 이슈 트래킹 |
| **Folio** | **이 셋을 하나의 워크스페이스로 통합** |

로컬 우선으로 시작해 팀 공유·Beacon·MCP까지 확장할 수 있습니다.
데이터는 브라우저 또는 Supabase/Beacon에 저장되며, Markdown/CSV/JSON/ZIP으로 내보낼 수 있습니다.

---

## 전체 기능 요약

| 영역 | 기능 |
|------|------|
| **일지** | 날짜별 기록 · 자동 저장 · 태그 자동완성 · Obsidian 가져오기 · 통계 · Writing-first 에디터 |
| **문서** | 마크다운 편집/프리뷰/분할 · 카테고리 · `[[위키링크]]` · 링크 그래프 · 역링크 |
| **일정** | 4컬럼 칸반 DnD · 우선순위/태그/즐겨찾기 · Jira · GitHub Issues |
| **프로세스** | Beacon Gate(P0–P4) · Timeline · 산출물 · 변경 감지 · 스냅샷 |
| **검색** | `Cmd/Ctrl+K` · 일지·문서·일정 통합 · 아이콘 확장 검색 |
| **저장** | local / cloud(Supabase) / beacon · 오프라인 큐 · PWA · **저장 관측(P47)** |
| **내보내기** | MD · CSV · JSON · ZIP · 탭별 ExportMenu · 전체 번들 |
| **연동** | Slack Block Kit · Discord Embeds · GitHub Issues/PR · MCP · 팀 초대/공유 |
| **협업** | Presence · 커서/타이핑/상태 · Yjs Undo/이력 · guest·ACL · 알림 센터 · 주석/@멘션 |
| **배포** | Vercel Preview/Production · Docker/GHCR · Actions CI/Deploy/Rollback/Monitor |
| **레이아웃** | Writing-first · 우측 요약 사이드바(280px) · 모바일 하단 네비/글쓰기 FAB · 스와이프 |
| **모바일** | PWA · Background Sync · 음성/이미지 · 키보드 보정 · FAB · 풀스크린 · 동기화 상태 |

스택: **Next.js 16 · React 19 · Tailwind v4 · shadcn/ui**

---

## 화면

실제 화면(로컬 실행, `로컬` 저장 모드). Writing-first 레이아웃 + 우측 요약 사이드바.

### 일지 — 날짜별 기록 · 태그 · Obsidian 가져오기
![일지](screenshots/dashboard.png)

### 문서 — 마크다운 편집/프리뷰 · `[[위키링크]]` · 링크 그래프
![문서](screenshots/docs.png)

### 일정 — 4컬럼 칸반(Backlog/In Progress/Review/Done) · Jira 동기화
![일정](screenshots/board.png)

### 프로세스 — Beacon Gate(P0–P4) · Timeline · 산출물 체크 · 스냅샷
![프로세스 - Gate와 산출물](screenshots/process.png)
![프로세스 - Timeline 이력](screenshots/process-2.png)

### 가이드 — 앱 안에서 바로 보는 온보딩/기능 안내(`/guide`)
![가이드 - 시작하기](screenshots/guide.png)
![가이드 - 단계별 안내](screenshots/guide-2.png)

---

## Phase 1~20

| Phase | 버전 | 요약 | 상태 |
|-------|------|------|------|
| **1** | 0.2.0 | Board DnD · Journal 태그 · Docs 프리뷰 · Supabase · Jira | ✅ |
| **2** | — | Auth UI · 멀티유저 · Obsidian 가져오기 · 통합 검색 · 고급 UI | ✅ |
| **3** | 0.4.0 | 팀 초대/공유 · 분석(recharts) · Slack/Discord/GitHub | ✅ |
| **4** | 0.5.0 | 배포 자동화 · PROCESS 규약 · Beacon 프로세스 탭 · 저장 모드 토글 | ✅ |
| **5** | 0.6.0 | 성능 · a11y · 문서화 · QA · 배포 강화 | ✅ |
| **6** | 0.7.0 | 모니터링/알림 · Beacon 고도화 · 운영 런북 | ✅ |
| **7** | 0.8.0 | Beacon 양방향 · 자동화/알림 | ✅ |
| **8** | 0.9.0 | 모바일 · 위젯 · PWA/오프라인 | ✅ |
| **9** | 1.0.0 | 실제 배포 (Vercel/Docker · 도메인/SSL · 롤백) | ✅ |
| **10** | 1.1.0 | 링크 그래프 · 내보내기 · MCP · Writing-first 레이아웃 | ✅ |
| **11** | 1.2.0 | 가이드/매뉴얼 · AI 요약 · 고급 분석 · Slack Block Kit | ✅ |
| **12** | 1.3.0 | Discord Embeds · GitHub PR/Board · 자동 배포 파이프라인 | ✅ |
| **13** | **1.4.0** | 실시간 협업 (Presence · Yjs · 주석 · 활동 스트림) | ✅ |
| **14** | **1.5.0** | 모바일 네이티브 (제스처 · 음성 · 이미지 · Background Sync) | ✅ |
| **15** | **1.6.0** | 협업 고도화 (커서 · Undo/diff · 역할 · 공유 · 알림) | ✅ |
| **16** | **1.7.0** | 모바일 고도화 (키보드 · FAB · 동기화 상태 · 풀스크린) | ✅ |
| **17** | **1.8.0** | 실시간 협업 고도화 (Presence 상태 · guest/ACL · 알림 센터) | ✅ |
| **18** | **2.0.0** | v2.0 기반 정비 (Vitest · CSP · CI · 마이그레이션 문서) | ✅ |
| **19** | **2.1.0** | 저장 관측 (감사 로그 · 대시보드 · 무결성 · 알림) | ✅ |
| **20** | **2.2.0-wip** | 협업 서버 옵션 (WebSocket · Yjs · 채팅 · 충돌) | 🔄 |

Phase 20 상세: P48 협업 서버 — WebSocket · Yjs sync · 채팅/화이트보드 · 3-way merge
Phase 19: P47 저장 관측  
이력: [VERSION.md](VERSION.md) · 마이그레이션: [docs/MIGRATION.md](docs/MIGRATION.md)

---

## 빠른 시작

```bash
git clone https://github.com/dayainow/folio.git
cd folio
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 열기.  
환경변수: [docs/env.example](docs/env.example) · 상세: [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md)

품질 검사:

```bash
npm run lint && npm run typecheck && npm run test && npm run qa:smoke
```

---

## v2.0 로드맵 · 마이그레이션

### 로드맵

| 테마 | 내용 | 상태 |
|------|------|------|
| **기반 정비** | Vitest · CI · ARCHITECTURE · CSP · sanitize | ✅ 2.0.0 |
| **저장·관측** | WithFallback 관측성 강화 (P47) | ✅ 2.1.0 |
| **협업** | Presence/Yjs 서버 동기화 옵션 (P48) | 🔄 2.2.0-wip |
| **DX** | 성능 예산 · 기여/테스트 가이드 | ✅ |

상세: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/PERFORMANCE.md](docs/PERFORMANCE.md) · [VERSION.md](VERSION.md)

### 1.x → 2.0 마이그레이션

1. `npm run runbook:backup` (또는 전체 ZIP 내보내기)
2. `git pull` · `npm ci` · `docs/env.example` 대조
3. `npm run lint && npm run typecheck && npm run test && npm run qa:smoke`

**호환성 주의**

- localStorage / 저장 모드 / Supabase 스키마: **하위 호환**
- CSP 추가: 외부 스크립트 CDN 사용 시 `next.config.ts` CSP 확장 필요
- `npm run test` = Vitest (더 이상 typecheck 별칭 아님)
- deprecated: `WidgetDashboard` → `WidgetSidebar`

전체: **[docs/MIGRATION.md](docs/MIGRATION.md)**

---

## 모바일 / PWA 사용법

스마트폰·태블릿에서도 Folio를 앱처럼 쓸 수 있습니다.

### 설치 (PWA)

1. **Chrome / Edge (Android·데스크톱)** — 주소창 또는 하단 설치 배너에서 **앱 설치**
2. **iOS Safari** — 공유 → **홈 화면에 추가** (안내 배너가 7일마다 다시 표시될 수 있음)
3. 설치 후 홈 화면 아이콘으로 전체 화면 실행

### 모바일 조작

| 동작 | 설명 |
|------|------|
| **하단 네비** | 일지 · 문서 · 일정 · 프로세스 탭 |
| **쓰기 FAB** | 중앙 버튼 → 오늘 일지 바로 열기 |
| **스와이프** | 좌/우 → 탭·날짜 · 상/하 → 요약 사이드바 |
| **음성** | 일지 툴바 **음성** (Web Speech 지원 브라우저) |
| **사진** | 일지 툴바 이미지 첨부 → 리사이즈 후 Markdown에 삽입 |

### 모바일 고도화 (P44)

| 기능 | 설명 |
|------|------|
| **가상 키보드** | 키보드가 올라오면 에디터 높이가 `visualViewport`에 맞춰 자동 조절 |
| **터치 타깃** | 주요 버튼·네비 최소 **48px** |
| **FAB 클러스터** | **저장** · **쓰기** · **새로 만들기** (일지/문서 컨텍스트) |
| **풀스크린** | 헤더의 전체화면 버튼으로 크롬 UI 숨김 · 종료 FAB로 복귀 |
| **동기화 상태** | 헤더 뱃지: 오프라인 / 업로드 중 / 완료 / 실패 · 로컬 우선 병합 |

### 오프라인

- 네트워크가 끊겨도 작성·편집이 가능합니다 (IndexedDB 큐)
- 다시 온라인이 되면 **Background Sync**(Chromium) 또는 앱 복귀 시 자동 동기화
- **로컬 변경 우선**으로 서버와 병합 · 헤더에 업로드/완료/실패 상태 표시
- 동기화 완료/복구 시 토스트 · (가능하면) 알림으로 안내합니다

자세한 문제 해결: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

## 실시간 협업 고도화 사용법

팀과 함께 일지·문서를 편집하고 권한·알림을 관리합니다. (Phase 17 / P45)

### Presence · 커서 · 상태

| 기능 | 설명 |
|------|------|
| **접속 아바타** | 헤더·협업 패널에 함께 편집 중인 사용자 표시 |
| **원격 커서** | 선택 영역이 실시간 공유되고 색상·이름 라벨로 표시 |
| **타이핑** | 다른 사용자가 입력 중이면 「입력 중…」 표시 |
| **상태** | **online** / **away** / **busy** 점 · 5분 무입력 시 away |
| **Undo/Redo** | 에디터 툴바 또는 `Ctrl/⌘+Z` · `Ctrl/⌘+Shift+Z` / `Y` |
| **이력 · Diff** | **이력** 버튼 → 스냅샷 비교 · 「원격 병합」 이력 · 복원 |

### 역할 · ACL · 초대

- 역할: **owner** · **admin** · **editor** · **viewer** · **guest** (`member`는 editor 취급, guest는 읽기 위주)
- 문서/보드 **공유** 버튼으로 팀에 view/edit 부여 + **세부 ACL**(view/comment/edit/admin)
- 팀 초대: 역할 · 만료일(1~30일) · **초대 메모** · **최대 사용 횟수** · 커스텀 링크 (`/?invite=<token>&note=…`)
- DB 마이그레이션: [docs/supabase-schema-team-p43.sql](docs/supabase-schema-team-p43.sql)

### 알림 센터

| 종류 | 설명 |
|------|------|
| **@멘션** | 주석에서 멘션 시 실시간 푸시 + 알림 센터 기록 |
| **공유 초대** | 문서·보드 공유 시 팀 알림 |
| **팀 초대** | 초대 생성 시 수신자 핸들 매칭 알림 |
| **Gate** | Beacon Gate 상태 변경 → 팀 전체 알림 |
| **히스토리** | 헤더 **벨** 아이콘 → 미읽음 · 전체 읽음 · 삭제 |

헤더 **Users** 협업 패널에서 Presence·주석·활동·알림 탭을 확인할 수 있습니다.

---

## MCP 가이드 — 다른 프로젝트 작업을 Folio에 쌓기

전체 매뉴얼: **[docs/MCP-GUIDE.md](docs/MCP-GUIDE.md)** · 상세 스펙: [docs/MCP.md](docs/MCP.md)

```text
다른 프로젝트 ←(MCP)→ Folio(.folio-mcp) ←(MCP 가져오기)→ Folio 화면
```

### 1) 다른 프로젝트에 연결 (1회)

```bash
cd /path/to/folio
npm run mcp:link -- /path/to/your-project --name my-app
```

설치: `.cursor/mcp.json` · `.vscode/mcp.json` · `.cursor/rules/folio-worklog.mdc` · `FOLIO-MCP.md`

### 2) Cursor에서 작업

1. 대상 프로젝트를 Cursor로 연다  
2. Settings → MCP 에서 `folio` 연결 확인  
3. Agent로 작업 → 규칙이 일지/보드에 자동 기록  
4. 필요 시 「Folio에 남겨줘」 요청

### 3) Folio 화면에 반영

```bash
cd /path/to/folio && npm run dev
```

사이드바/헤더 **「MCP 가져오기」** → 일지/문서/일정 확인

### 4) (선택) Git 푸시·CLI

```bash
npm run mcp:client -- webhook '{"message":"feat: demo","author":"you"}'
npm run mcp:client -- tools
npm run mcp:client -- call journal_read '{}'
```

GitHub Webhook: `POST /api/mcp/git-webhook` + `FOLIO_MCP_WEBHOOK_SECRET`

---

## 배포 파이프라인

상세: [docs/DEPLOY.md](docs/DEPLOY.md) · 런북: [docs/runbooks/DEPLOY.md](docs/runbooks/DEPLOY.md)  
환경변수 템플릿: [.env.production.example](.env.production.example)

| 경로 | 동작 |
|------|------|
| **Vercel Git** | PR → Preview · `main` → Production |
| **Actions `ci.yml`** | lint · typecheck · qa:smoke · build |
| **Actions `deploy.yml`** | 게이트 → Vercel Production → `/api/health` · `/api/runtime` → 실패 시 롤백 |
| **Actions `docker.yml`** | multi-stage 이미지 → **GHCR** (`ghcr.io/<owner>/folio`) |
| **Actions `rollback.yml`** | `vercel rollback` (수동 · deploy 헬스 실패 시) |
| **Actions `monitor.yml`** | 30분마다 Production 헬스 프로브 |

```bash
# 로컬 Docker
cp docs/env.example .env.local
docker compose up --build -d
curl -sS http://localhost:3000/api/health

# 배포 후 헬스 (Actions와 동일 스크립트)
FOLIO_PRODUCTION_URL=https://your-domain.com npm run deploy:health
```

GitHub Secrets (선택): `VERCEL_TOKEN` · `VERCEL_ORG_ID` · `VERCEL_PROJECT_ID` · `FOLIO_PRODUCTION_URL`

---


## 협업 서버 (P48)

로컬 BroadcastChannel / Supabase Realtime에 더해 **전용 WebSocket 서버**로 Yjs·채팅·화이트보드·WebRTC 시그널링을 확장합니다.

### 빠른 시작

```bash
npm run collab:server   # ws://127.0.0.1:1234/collab
npm run dev
```

사이드바 **협업 · 로컬/서버/하이브리드**에서 모드 선택. 서버 모드에서는 `NEXT_PUBLIC_COLLAB_WS_URL` 또는 토글의 URL을 사용합니다.

| 기능 | 설명 |
|------|------|
| **Yjs sync** | 문서/일지 room · Awareness(커서/타이핑) |
| **채팅** | 협업 패널 → 채팅 탭 |
| **화이트보드** | 협업 패널 → 보드 탭 |
| **음성/화면공유** | WebRTC 시그널링 (`collab-webrtc`) — 옵션 |
| **충돌 해결** | 3-way merge UI · [CONFLICT-RESOLUTION.md](docs/CONFLICT-RESOLUTION.md) |

문서: [COLLAB-SERVER.md](docs/COLLAB-SERVER.md) · [WEBSOCKET.md](docs/WEBSOCKET.md)

## 저장 관측 (P47)

일지·문서·일정 저장 시 `saveWithFallback` 경로의 성공/실패·지연·모드를 기록하고, 사이드바에서 확인할 수 있습니다.

### 대시보드

1. 우측 요약 사이드바 → **저장 관측** 버튼
2. 확인 항목:
   - **성공률** · **평균 응답시간** · **실패/폴백** · **연속 실패**
   - 시간별 저장 추이 · 모드별(local/cloud/beacon) 사용량 (Recharts)
   - 실패 원인 상위 목록 · 최근 감사 이벤트
3. **검사 실행** — localStorage / Supabase 캐시 / Beacon checksum 비교 · 불일치 시 복구 제안
4. **로그 비우기** — 브라우저 감사 로그 초기화 (보존 기간 경과분도 자동 정리)

### 알림 · 재시도

| 항목 | 동작 |
|------|------|
| **원격 실패** | 최대 3회 지수 백오프 재시도 후 로컬 폴백 · 오프라인 큐 적재 |
| **연속 실패** | 임계값 이상이면 Slack / Discord / 브라우저 푸시 알림 |
| **쿨다운** | 웹훅·푸시 알림 과다 발송 방지 |

### 환경변수

| 키 | 기본 | 설명 |
|----|------|------|
| `AUDIT_LOG_RETENTION_DAYS` | `30` | 감사 로그 보존 일수 |
| `STORAGE_ALERT_THRESHOLD` | `3` | 연속 저장 실패 알림 임계 |

템플릿: [docs/env.example](docs/env.example) · 런타임 노출: `GET /api/runtime` (`auditLogRetentionDays` · `storageAlertThreshold`)

---

## Discord / GitHub 연동

환경변수: [docs/env.example](docs/env.example) · Production: [.env.production.example](.env.production.example)

### Discord Embeds

1. Discord 채널 → 연동 → 웹후크 → URL 복사
2. `DISCORD_WEBHOOK_URL` 설정 (`.env.local` / Vercel)
3. 저장 완료 · 태스크 Done · Gate 변경 시 **Rich Embed** 전송
   - 초록(완료) · 주황(경고) · 파랑(정보)
   - Footer: Folio 링크 + timestamp (`NEXT_PUBLIC_FOLIO_URL`)

### GitHub Issues / PR

1. `GITHUB_TOKEN` · `GITHUB_REPO=owner/repo` 설정
2. 일정(Board) 탭 → **GitHub 동기화** — Issue 상태·담당자·라벨 반영
3. Webhook: `POST /api/github/webhook` (Events: `pull_request`, `issues`, `workflow_run`)
   - 시크릿: `GITHUB_WEBHOOK_SECRET` (또는 `FOLIO_MCP_WEBHOOK_SECRET`)
4. PR 머지 시 연결된 Board 태스크가 **Done**으로 이동
5. (선택) Actions `folio-sync.yml` — `FOLIO_WEBHOOK_URL` / `FOLIO_WEBHOOK_SECRET`

---

## 실시간 협업

의존성: `yjs` · `y-protocols` · Supabase Realtime(선택) / BroadcastChannel 폴백

### 사용법

| 기능 | 사용법 |
|------|--------|
| **Presence** | 일지·문서 편집 시 접속 아바타 · 헤더 **Users** 아이콘 → 협업 패널 |
| **동시 편집** | Journal/Docs에서 같은 문서를 열면 `CollabTextarea`로 실시간 동기화 |
| **주석** | 에디터 하단 주석 · `@이름` 멘션 · 해결/미해결 토글 |
| **활동 스트림** | 우측 사이드바 · 협업 패널 · 저장/주석/태스크 완료 이벤트 필터 |

선택 스키마(클라우드 주석·활동): [docs/supabase-schema-collab.sql](docs/supabase-schema-collab.sql)

### Yjs / CRDT

Folio는 동시 편집 충돌 해결에 **[Yjs](https://yjs.dev/)** CRDT를 사용합니다.

- **CRDT**(Conflict-free Replicated Data Type): 각 클라이언트가 독립적으로 편집해도 병합 결과가 수렴합니다. 잠금(lock)이나 중앙 OT 서버가 필수는 아닙니다.
- **룸**: `journal:YYYY-MM-DD` · `doc:<id>` — 같은 룸을 연 탭/사용자가 업데이트를 교환합니다.
- **전송**: Supabase Realtime Broadcast가 있으면 사용하고, 없으면 같은 브라우저의 `BroadcastChannel`로 폴백합니다.
- **MVP**: 본문은 Y.Text에 미러링됩니다. Presence(접속·커서)는 Realtime Presence / BroadcastChannel으로 별도 공유합니다.

```text
클라이언트 A ──Yjs update──▶ Realtime / BroadcastChannel ──▶ 클라이언트 B
       ▲                         CRDT 병합                         │
       └──────────────────── 동일 문서 상태로 수렴 ◀────────────────┘
```

---

## 가이드 (처음 쓰는 분)

앱 헤더 **가이드** → [`/guide`](http://localhost:3000/guide) 또는 아래 문서:

| 문서 | 내용 |
|------|------|
| **[온보딩 10분](docs/ONBOARDING.md)** | Folio 열기 → 저장 모드 → 일지 → 태그 → 문서 → 일정 |
| **[기능 상세](docs/FEATURES.md)** | 일지·문서·일정·프로세스·검색·저장·내보내기·MCP |
| **[문제 해결](docs/TROUBLESHOOTING.md)** | 저장/로그인/Beacon/PWA/데이터 복구 |

---

## 사용 가이드

| 주제 | 문서 |
|------|------|
| **내부 사용 가이드** | [docs/INTERNAL.md](docs/INTERNAL.md) |
| 설치·시작 | [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) |
| **기여 가이드** | [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) |
| **MCP 가이드** | [docs/MCP-GUIDE.md](docs/MCP-GUIDE.md) |
| MCP 레퍼런스 | [docs/MCP.md](docs/MCP.md) |
| 아키텍처 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 배포 | [docs/DEPLOY.md](docs/DEPLOY.md) |
| Beacon 연동 | [docs/BEACON.md](docs/BEACON.md) |
| 접근성 | [docs/A11Y.md](docs/A11Y.md) |
| API 레퍼런스 | [docs/API.md](docs/API.md) |
| 버전 이력 | [VERSION.md](VERSION.md) |

---

## 개발

```bash
npm run build
npm run lint          # --max-warnings 0
npm run typecheck
npm run qa:smoke
npm run runbook:backup
```

자세한 내용은 **[기여 가이드](docs/CONTRIBUTING.md)**를 참고하세요.

---

## 로드맵

- **v1.0** ✅ — 일지·문서·일정·검색·팀·배포
- **v1.1** ✅ — 링크 그래프·내보내기·MCP·Writing-first
- **v1.2** ✅ — 가이드/매뉴얼 · AI 요약·고급 분석·Slack 고급
- **v1.3** ✅ — Discord Embeds · GitHub PR/Board · 자동 배포 파이프라인
- **v1.4** ✅ — 실시간 협업 (Presence · Yjs · 주석 · 활동 스트림)
- **v1.5** ✅ — 모바일 네이티브 (제스처 · 음성 · 이미지 · Background Sync)
- **v1.6** ✅ — 협업 고도화 (커서 · Undo/diff · 역할 · 공유 · 알림)
- **v1.7** ✅ — 모바일 고도화 (키보드 · FAB · 동기화 상태 · 풀스크린)
- **v1.8** ✅ — 실시간 협업 고도화 (Presence 상태 · guest/ACL · 알림 센터)
- **v2.0** ✅ — 기반 정비 · 테스트 · CSP · CI · 마이그레이션 문서
- **v2.1** ✅ — 저장 관측 (감사 로그 · 대시보드 · 무결성 · 알림)
- **v2.2** 🔄 — 협업 서버 옵션 (WebSocket · Yjs · 채팅 · 충돌 해결)

## 작업 관리

- 현재 Phase: **Phase 20** (v**2.2.0-wip**)
- 진행 중: **P48** 협업 서버 옵션 (WebSocket · Yjs · 채팅 · 충돌 해결)
- 완료: Phase 1~19 (2.1.0) · P47 저장 관측
- 다음: Phase 20 마무리 · 2.2.0 정식
- 이어가기: `git pull origin main` 후 이 상태에서 진행 ([VERSION.md](VERSION.md))

---

## 라이선스

Copyright (c) dayainow. All rights reserved.

본 저장소는 private 프로젝트입니다. 사전 허가 없이 복제·재배포·상업적 이용을 할 수 없습니다.
기여 시 [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)를 따라 주세요.

---

**Folio** — 프로젝트의 기록, 한 곳에서. · v2.2.0-wip
