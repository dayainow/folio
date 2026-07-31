# Folio

프로젝트의 기록을 남기는 개발자 워크스페이스.  
**Developer workspace for project records.**

| | |
|--|--|
| 버전 | **1.1.0-wip** (Phase 10) |
| 라이선스 | private |

---

## 소개 / Introduction

Folio는 브라우저(및 선택적으로 Supabase · Beacon)에 저장되는 개인·팀용 워크스페이스다.  
일지 · 문서 · 칸반 · 프로세스(Beacon)를 한 화면에서 다룬다.

Folio is a personal/team workspace stored in the browser (optionally Supabase / Beacon), covering journals, docs, kanban, and process views.

---

## 기능 / Features

| 영역 | 내용 |
|------|------|
| 일지 (Journal) | 날짜별 기록, 태그, 자동 저장, 통계, 알림(옵션) |
| 문서 (Docs) | 마크다운 편집·미리보기·분할, `[[wiki]]` 링크 그래프, Obsidian 가져오기 |
| 일정 (Board) | 칸반 + 키보드 이동, Jira/GitHub, 즐겨찾기, 분석 |
| 프로세스 | Beacon Gate / Timeline / 산출물 · 양방향 편집 · 자동화 |
| 팀 | 초대 · 멤버 · 문서/보드 공유 (Supabase) |
| 검색 | ⌘/Ctrl+K 통합 검색 |
| 저장 모드 | 로컬 / 클라우드 / Beacon |
| 접근성 | 스킵 링크, 키보드, ARIA, 포커스 트랩 (P16) |
| 모바일 / PWA | 하단 네비 · 위젯 · 오프라인 · 홈 화면 설치 |

스택: Next.js 16 · React 19 · Tailwind v4 · shadcn/Base UI · Supabase · @dnd-kit

---

## 빠른 시작 / Quick start

```bash
cp docs/env.example .env.local   # fill values
npm install
npm run dev
# http://localhost:3000
```

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

자세한 설치: **[docs/GETTING-STARTED.md](./docs/GETTING-STARTED.md)**

---

## 사용 가이드 / Usage

1. 헤더에서 **저장 모드** 선택 (기본: 로컬)
2. 탭: 일지 · 문서 · 일정 · 프로세스
3. 검색창 또는 ⌘K 로 Journal/Docs/Board 검색
4. (선택) 로그인 후 팀 관리 · 클라우드 동기화

시나리오 예시:

- [examples/basic-usage.md](./examples/basic-usage.md)
- [examples/team-setup.md](./examples/team-setup.md)

Beacon: [docs/BEACON.md](./docs/BEACON.md) · [PROCESS.md](./PROCESS.md)

---

## PWA / 오프라인 사용법

### 설치 (홈 화면에 추가)

1. 프로덕션 빌드 후 접속: `npm run build && npm run start` (또는 Vercel Production)
2. Chrome/Edge: 주소창 설치 아이콘 또는 화면의 **「홈 화면에 추가」** 안내
3. iOS Safari: 공유 → **홈 화면에 추가**
4. `display: standalone` 으로 앱처럼 실행 (`public/manifest.json`)

> `next dev` 에서는 Service Worker가 꺼져 있습니다. PWA 검증은 빌드/배포본에서 하세요.

### 오프라인 · 동기화

1. 네트워크 끊김 시 헤더에 **오프라인** 뱃지 표시
2. 일지/문서/보드는 로컬 + IndexedDB(`folio-offline`)에 미러 저장
3. 클라우드/Beacon 모드에서 원격 실패·오프라인 시 **동기화 큐**에 적재
4. 온라인 복구 시 자동 flush · 헤더 **동기화 N** 뱃지로 수동 재시도 가능

### 푸시 알림

1. 화면의 **알림 허용** (또는 브라우저 권한) — 사용자 동의 후에만
2. 트리거: 일지/문서 저장 완료 · 팀 초대 생성 · Gate 자동 PASS
3. (선택) Web Push: `.env`에 VAPID 키  
   `npx web-push generate-vapid-keys` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`

### 캐시 전략

| 대상 | 전략 |
|------|------|
| 정적 자산 (JS/CSS/이미지/폰트) | CacheFirst |
| `/api/*` | NetworkFirst (타임아웃 후 캐시) |
| 페이지 네비게이션 | NetworkFirst |

```bash
npm run build   # --webpack (PWA SW 생성)
npm run start
```

---

## Beacon 고도화 사용법

프로젝트 루트에 `.beacon/` 이 있고 `BEACON_PROJECT_ROOT`(선택)가 맞으면 **프로세스** 탭이 활성화된다.

### 기본 보기 · 편집 (P14 / P23)

1. 프로세스 탭에서 Gate (P0–P4) · Timeline · 산출물 확인
2. 이름 / Gate / 체크리스트 수정 후 **프로세스 저장** → `project.json` 의 `folio` 오버레이에 append-only 기록
3. 외부(CLI)와 mtime 충돌 시 **병합** 또는 **재적용**
4. Docs에서 **Beacon으로 export** → `.beacon/artifacts/folio/<category>/`
5. Timeline 기록은 동의 토글 후에만 (기본 off)

### 변경 감지 · Diff · 스냅샷 (P21 / P24)

1. **자동 감지** 토글 ON → `.beacon/project.json` / `beacon.db` 변경 시 live Diff · 토스트 · 헤더 「Beacon 변경」 뱃지
2. **스냅샷** 버튼 또는 변경/주기 백업 → `.beacon/snapshots/`
3. 스냅샷 Diff에서 이전/이후 비교

### Gate · 산출물 자동화 (P24)

1. 산출물 체크리스트 완료율 100% → Gate 자동 PASS (UI draft · 저장 시 반영)
2. Gate PASS인데 체크리스트 미완료면 경고 배너
3. Docs 저장 시(기본 ON) 카테고리 기반 artifact 자동 생성

### Timeline 분석 (P24)

- 프로세스 탭 하단: 이번 주 / 이번 달 변경 횟수 · 28일 히트맵 · 소스/카테고리 집계

상세 규약: [docs/BEACON.md](./docs/BEACON.md) · [PROCESS.md](./PROCESS.md)

---

## 배포 / Deploy

상세: [docs/DEPLOY.md](./docs/DEPLOY.md) · 런북: [docs/runbooks/DEPLOY.md](./docs/runbooks/DEPLOY.md)  
환경변수: [docs/env.example](./docs/env.example) · [.env.production.example](./.env.production.example)

| 방식 | 요약 |
|------|------|
| Vercel | `main` → Production · PR → Preview (`vercel.json`) |
| Docker | `Dockerfile` 멀티스테이지 · `docker compose up --build` |
| CI | lint · typecheck · `qa:smoke` · build (`.github/workflows/ci.yml`) |
| Health | `GET /api/health` · `/health` rewrite → `{ status, version, uptime }` |
| Domain | Settings → Domains · SSL 자동(Let’s Encrypt) |

브랜치: feature → PR (Preview) → `main` 머지 (Production)

### Vercel Production 배포 가이드

1. [vercel.com](https://vercel.com) → GitHub `dayainow/folio` Import (Framework: Next.js)
2. Project → **Settings → Environment Variables** 에 `.env.production.example` 기준으로 Production 값 등록  
   (`NEXT_PUBLIC_SUPABASE_*`, `NEXT_PUBLIC_FOLIO_URL`, 선택: Jira/웹훅/VAPID/`FOLIO_VERSION`)
3. Supabase Auth → Site URL / Redirect URLs 에 Production·`*.vercel.app` 등록
4. `main` 머지 또는 CLI로 배포:

```bash
npx vercel link          # 최초 1회
npx vercel --prod        # Production
# 또는: npm run runbook:deploy
```

5. 검증:

```bash
curl -sS https://<host>/api/health
curl -sS https://<host>/api/runtime
```

6. (선택) **Settings → Domains** 에 커스텀 도메인 · SSL은 Vercel 자동 갱신  
7. 롤백: Deployments → 이전 배포 **Promote to Production** 또는 `npx vercel rollback`

### Docker 로컬 배포 가이드

```bash
cp docs/env.example .env.local   # 값 채움 (Supabase 등)
docker compose up --build -d
curl -s http://localhost:3000/api/health
# → {"status":"ok","version":"1.0.0",…}

# 로그 / 중지
docker compose logs -f folio
docker compose down
```

직접 빌드:

```bash
docker build -t folio:1.0.0 \
  --build-arg FOLIO_VERSION=1.0.0 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  .
docker run --rm -p 3000:3000 --env-file .env.local folio:1.0.0
```

> HEALTHCHECK는 `node fetch`로 `/api/health`를 주기적으로 확인한다.

---

## 문서 / Docs

| 문서 | 설명 |
|------|------|
| [GETTING-STARTED](./docs/GETTING-STARTED.md) | 설치 · 실행 · 기본 사용 |
| [ARCHITECTURE](./docs/ARCHITECTURE.md) | 폴더 · 데이터 흐름 · 저장 모드 |
| [BEACON](./docs/BEACON.md) | Beacon 연동 · 경로 · 제약 |
| [DEPLOY](./docs/DEPLOY.md) | Vercel · Docker · 로컬 |
| [MCP](./docs/MCP.md) | MCP 서버 · IDE/Git/CLI |
| [runbooks](./docs/runbooks/) | Incident · Backup · Deploy · Upgrade |
| [A11Y](./docs/A11Y.md) | 접근성 · 단축키 |
| [API](./docs/API.md) | `src/lib` 시그니처 |
| [qa-report](./docs/qa-report.md) | P18 통합 QA 결과 |
| [a11y-checklist](./docs/a11y-checklist.md) | 수동 a11y 체크 |
| [PROCESS](./PROCESS.md) | Beacon 규약 |
| [VERSION](./VERSION.md) | 버전 · 작업 이력 |

성능 측정: `npm run bundle:size` · `perf:measure` · `ANALYZE=true npm run analyze`  
QA 스모크: `npm run qa:smoke`  
런북: `npm run runbook:backup` · `runbook:restore` · `runbook:deploy`

---

## QA 체크리스트

상세 결과: **[docs/qa-report.md](./docs/qa-report.md)**

- [ ] 일지: 저장 → 날짜 이동 → 재진입 내용 유지
- [ ] 일지: 태그 추가/삭제 → 최근 기록 · 태그 클라우드 필터
- [ ] 문서: 생성 → 편집 → 저장 → 읽기 모드 반영
- [ ] 일정: 생성 → ←/→ 이동 → 편집 → 삭제
- [ ] 일정: DnD 드롭 후 새로고침에도 status 유지
- [ ] 프로세스: Gate / Timeline / 산출물 (`.beacon` 있을 때)
- [ ] 저장 모드: 로컬 동작 · 미로그인 시 클라우드 비활성 · Beacon available 시만 활성
- [ ] 검색: ⌘K · 결과 클릭 시 탭 이동
- [ ] 다크모드: 토글 후 새로고침 유지
- [ ] 분석: 기간 변경 시 차트 갱신

```bash
npm run qa:smoke && npm run lint && npm run typecheck
```

---

## 기여 / Contributing

1. feature 브랜치에서 작업 → PR (Preview)
2. `npm run lint && npm run typecheck` 통과
3. Conventional Commits (한국어 메시지 권장): `feat:` / `fix:` / `docs:` …
4. `VERSION.md` · README **작업 관리**를 함께 갱신

이슈·PR은 GitHub `dayainow/folio` 에서 받는다.

---

## 작업 관리

- 현재: **Phase 10** · **1.1.0-wip**
- 완료: Phase 1~9 (**1.0.0**) · P31 · P32
- 진행 중: **P33** MCP 연동
- 다음: Phase 10 마무리 · 1.1.0 정식

상세: [VERSION.md](./VERSION.md) · [docs/MCP.md](./docs/MCP.md) · [docs/DEPLOY.md](./docs/DEPLOY.md)

## Phase 요약

| Phase | 내용 | 상태 |
|-------|------|------|
| 1 | Journal / Docs / Board + 브랜딩 | ✅ |
| 2 | Supabase · Auth · Jira · 멀티유저 | ✅ |
| 3 | Obsidian · 검색 · 팀 · 분석 · 알림 | ✅ |
| 4 | 배포 · Beacon · 저장 모드 | ✅ |
| 5 | 성능 · 접근성 · 문서화 · QA · 배포 자동화 | ✅ **0.6.0** |
| 6 | 모니터 · Beacon 고도화 · 운영 런북 | ✅ **0.7.0** |
| 7 | Beacon 양방향 · 자동화/알림 | ✅ **0.8.0** |
| 8 | 모바일 · Slack · 위젯 · PWA/오프라인 | ✅ **0.9.0** |
| 9 | 실제 배포 · 운영 | ✅ **1.0.0** |
| 10 | 링크 그래프 · 내보내기 · MCP | 진행 중 (P33) |

## Phase 10 계획

| 영역 | 내용 |
|------|------|
| P31 문서 링크 그래프 | ✅ `[[문서명]]` · force-graph · 자동완성 · 역링크 |
| P32 내보내기/다운로드 | ✅ MD · CSV · JSON · ZIP |
| P33 MCP 연동 | IDE/Git/CLI · tools/resources/prompts · webhook |

## 내보내기 / 다운로드

| 위치 | 옵션 |
|------|------|
| 일지 탭 | Markdown (기간) · 오늘 Markdown |
| 문서 탭 | 선택 문서 MD · 필터/카테고리 ZIP · 전체 ZIP |
| 일정 탭 | CSV · JSON |
| 헤더 | **전체 내보내기** → `journals/` · `docs/` · `boards/` · `metadata.json` |

사이드바 날짜 범위·카테고리 필터가 있으면 해당 범위만 내보냅니다.

## MCP / CLI

상세: **[docs/MCP.md](./docs/MCP.md)** · IDE: [`.vscode/mcp.json`](./.vscode/mcp.json)

```bash
# stdio MCP 서버 (Cursor/VS Code)
npm run mcp:server

# CLI 클라이언트
npm run mcp:client -- tools
npm run mcp:client -- call journal_read '{}'
npm run mcp:client -- call board_list '{"status":"in_progress"}'
npm run mcp:client -- resources

# Git webhook (dev 서버 필요)
npm run mcp:client -- webhook '{"message":"feat: demo from cli"}'
```

| 경로 | 용도 |
|------|------|
| `npm run mcp:server` | stdio MCP |
| `POST /api/mcp` | HTTP Streamable MCP |
| `POST /api/mcp/git-webhook` | Git 커밋 → Timeline/일지/보드 |

## Docs wiki-link 사용법

1. 문서 본문에 `[[문서명]]` 또는 `[[문서명|별칭]]` 입력
2. 편집 중 `[[` 입력 시 기존 문서 자동완성 (↑↓ · Enter)
3. 우측(또는 하단) **링크 그래프**에서 노드 클릭 → 해당 문서 이동
4. 문서 하단 **역링크**로 나를 가리키는 문서 확인
5. 저장하면 그래프가 문서 집합 기준으로 갱신됩니다
