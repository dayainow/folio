# Folio 버전 / 작업 이력

커밋·푸시할 때마다 이 문서와 `README.md`의 **작업 관리** 섹션을 함께 갱신한다.

## 현재

| 항목 | 값 |
|------|-----|
| 버전 | **1.2.0-wip** (고정 체크포인트) |
| Phase | Phase 11 |
| 진행 중 | — |
| 다음 | AI 요약 · 고급 분석 · Slack 고급 · 1.2.0 정식 |
| 이어가기 | `origin/main` @ 본 체크포인트 이후 커밋부터 |

## 완료 항목

| ID | 요약 | 커밋 |
|----|------|------|
| P1 | Board 칸반 카드 드래그 앤 드롭 | `9f71420` |
| P2 | Journal 태그 자동완성 | `99b5ef2` |
| P3 | Docs 마크다운 프리뷰 (편집/미리보기/분할) | `2ba620f` |
| P3.1 | Folio 브랜딩 + README 작업 관리 | `c02fade` |
| P4 | Supabase 클라이언트/env 스캐폴드 | `08dc0f9` |
| P4-2 | Supabase DB 스키마 + UI 전환(폴백) | `e761ac2` |
| P5 | Jira 연동 (fetch/동기화/카드 링크) | `48356b4` |
| P4-3 | Supabase Auth UI | `916a875` |
| P6 | 멀티유저 데이터 분리 | `b49d2ea` |
| P7 | Obsidian 마크다운 가져오기 | `1d82a5e` |
| P8 | 통합 검색 | `1abb47c` |
| P9 | 고급 기능 (태그·날짜·다크모드·즐겨찾기) | `94ea5ea` |
| P10 | 팀 초대/공유 + Jira search/jql | `afb7af5` |
| P11 | 고급 분석 (recharts) | `9754d7b` |
| P12 | Slack/Discord/GitHub 외부 연동 | `49ef9b2` |
| P13 | 배포 자동화 (Vercel / Docker / CI) | `24d4c02` |
| — | 프로세스 연동 규약 (`PROCESS.md`) | `0194147` |
| P14 | 프로세스 탭 UI (Gate / Timeline / 산출물) | `93a6d97` |
| P14 | beacon.db WAL 읽기 수정 | `0574210` |
| P14-2 | 상태 기반 저장 토글 (local / cloud / beacon) | `ffa70d8` |
| P15 | 성능 최적화 (code splitting · debounce · memo · 번들) | `e40db3f` |
| — | 저장 로컬 선행 · Journal 저장 피드백 | `10c6fef` |
| P16 | 접근성/UX (키보드 · 포커스 · ARIA · 로딩) | `781f2ed` |
| P17 | 문서화 (GETTING-STARTED · API · examples) | `2b6597b` |
| P18 | 통합 테스트/QA | `52ed45e` |
| P19 | 배포 자동화 강화 · health · 0.6.0 릴리즈 | `3fecfdf` |
| P20 | 모니터링/알림 | `1416576` |
| P21 | Beacon 고도화 | `4ca166d` |
| P22 | 운영 런북 · runtime API · 0.7.0 릴리즈 | `461cf0b` |
| P23 | Beacon 양방향 연동 | `b570b5c` |
| P24 | Beacon 자동화/알림 | `f4e4dce` |
| — | Phase 7 완료 · 0.8.0 릴리즈 | `7d40004` |
| P25 | 모바일·알림·위젯 | `98b838a` |
| P26 | 오프라인/PWA | `525422e` |
| — | Phase 8 완료 · 0.9.0 릴리즈 | `ea94c5a` |
| P27 | 실제 배포 | `d11e16f` |
| — | Phase 9 완료 · 1.0.0 릴리즈 | `e2d278f` |
| P31 | 문서 링크 그래프 | `45e3e40` |
| P32 | 내보내기/다운로드 | `86750d4` |
| P33 | MCP 연동 | `813c3ea` / UX `9dd8874` |
| P34 | Writing-first 레이아웃 | `92ef4e6` |
| — | Phase 10 완료 · 1.1.0 릴리즈 | `d070a2f` |
| P35 | 온보딩·기능·문제해결 가이드 + `/guide` | `e24c1ae` |

## 진행 중

| ID | 요약 | 노트 |
|----|------|------|
| — | — | 다음 세션에서 Phase 11 기능 작업 시작 |

## Phase 11 계획

| ID | 요약 | 노트 |
|----|------|------|
| P35 | 가이드/매뉴얼 | ✅ ONBOARDING · FEATURES · TROUBLESHOOTING · `/guide` · `e24c1ae` |
| — | 1.2.0-wip 체크포인트 | ✅ 1.1.0 마감 후 상태 고정 (이 지점부터 이어가기) |
| P36+ | AI 요약 · 고급 분석 · Slack 고급 | 예정 |
| — | 1.2.0 정식 | Phase 11 완료 시 |

## Phase 10 계획 (완료)

| ID | 요약 | 노트 |
|----|------|------|
| P31 | 문서 링크 그래프 | ✅ `[[wiki]]` · force-graph · `45e3e40` |
| P32 | 내보내기/다운로드 | ✅ MD/CSV/JSON/ZIP · `86750d4` |
| P33 | MCP 연동 | ✅ IDE/Git/CLI · UX · `813c3ea` / `9dd8874` |
| P34 | Writing-first 레이아웃 | ✅ 위젯→사이드바 · 에디터 확대 · `92ef4e6` |
| — | 1.1.0 정식 | ✅ Phase 10 완료 릴리즈 |

## Phase 7 계획

| ID | 요약 | 노트 |
|----|------|------|
| P23 | Beacon 양방향 | ✅ Folio 오버레이 · artifact export · timeline |
| P24 | Beacon 자동화/알림 | ✅ 변경 감지 · Gate PASS · analytics |

## Phase 8 계획

| ID | 요약 | 노트 |
|----|------|------|
| P25 | 모바일·알림·위젯 | ✅ 하단 네비 · Slack 버튼 · 위젯 DnD |
| P26 | 오프라인/PWA | ✅ SW · IndexedDB · 푸시 |

## Phase 9 계획

| ID | 요약 | 노트 |
|----|------|------|
| P27 | 실제 배포 | ✅ Vercel/Docker · 도메인/SSL · 롤백 |
| — | 1.0.0 정식 | ✅ Phase 9 완료 릴리즈 |

## Phase 6 계획 (배포·운영)

| ID | 요약 | 노트 |
|----|------|------|
| P20 | 모니터링/알림 | ✅ |
| P21 | Beacon 고도화 | ✅ |
| P22 | 운영 런북 | ✅ |

## 변경 이력

### 1.2.0-wip — 2026-07-31 (체크포인트 · P35 가이드/매뉴얼)

- **상태 고정:** 1.1.0 정식 마감 후, P35까지 반영한 **1.2.0-wip** 를 다음 작업의 시작점으로 고정
- `docs/ONBOARDING.md` — 처음 10분 스텝바이스텝
- `docs/FEATURES.md` — 기능별 상세 (일지·문서·일정·프로세스·검색·저장·내보내기·MCP)
- `docs/TROUBLESHOOTING.md` — 저장/로그인/Beacon/PWA/복구
- `/guide` 인앱 가이드 페이지 (탭 · 사이드바 TOC · 마크다운 렌더 · 다크모드)
- 헤더 **가이드** 링크 · README 가이드 섹션
- 기준 커밋: P35 `e24c1ae` · 체크포인트 문서화(본 항목)

### 1.1.0 — 2026-07-31 (Phase 10 완료)

- 정식 릴리즈 **1.1.0** (Phase 10: 링크 그래프 · 내보내기 · MCP · Writing-first 레이아웃)
- **P31** 문서 링크 그래프 (`45e3e40`)
  - `[[문서명]]` / `[[문서명|별칭]]` 파서 · force-graph · `[[` 자동완성 · 역링크
- **P32** 내보내기/다운로드 (`86750d4`)
  - 일지 MD · 문서 MD/ZIP · Board CSV/JSON · 전체 ZIP · ExportMenu
- **P33** MCP 연동 (`813c3ea`, UX `9dd8874`)
  - Folio MCP 서버 · git-webhook · `mcp:link` · MCP-GUIDE · UI **MCP 가져오기**
- **P34** Writing-first 레이아웃 (`92ef4e6`)
  - 위젯 → 우측 280px 사이드바 · 에디터 `min-h-[80vh]` · 검색 아이콘 확장 · 모바일 하단 시트
- `package.json` 버전 **1.1.0** · README Phase 1~10 완료 표 · CONTRIBUTING

### 1.1.0-wip — 2026-07-31 (P34 Writing-first 레이아웃) — `92ef4e6`

- 상단 위젯 3카드를 우측 280px 사이드바로 이동 (일지 미리보기 · 진행 태스크 · Gate 프로그레스)
- 헤더 최소화: 로고 + 탭 · 검색 아이콘 확장 · 저장/테마는 사이드바 하단
- Journal/Docs 에디터 `min-h-[80vh]` · 모바일 사이드바 하단 시트

### 1.1.0-wip — 2026-07-31 (P33 MCP UX · 외부 프로젝트 연결) — `9dd8874`

- `npm run mcp:link` · `templates/external-project/` · 작업기록 Cursor 규칙
- `docs/MCP-GUIDE.md` 간단 매뉴얼 · 헤더 **MCP 가져오기** (UI 동기화)
- `GET /api/mcp/store` · `src/lib/mcp-sync.ts`

### 1.1.0-wip — 2026-07-31 (P33 MCP 연동) — `813c3ea`

- `src/mcp/`: Folio MCP 서버 (stdio + HTTP) · journal/doc/board tools · resources · prompts
- `.vscode/mcp.json` · `docs/MCP.md` · `scripts/mcp-client.mjs`
- `POST /api/mcp/git-webhook` → Timeline · 일지 · Board 연동

### 1.1.0-wip — 2026-07-31 (P32 내보내기/다운로드) — `86750d4`

- `src/lib/export.ts`: 일지 MD · 문서 MD/ZIP · Board CSV/JSON · 전체 ZIP 번들
- `jszip` · `ExportMenu` 진행 표시 · 헤더 전체 내보내기
- Journal/Docs/Board 탭별 내보내기 드롭다운

### 1.1.0-wip — 2026-07-31 (P31 문서 링크 그래프) — `45e3e40`

- `src/lib/link-parser.ts`: `[[문서명]]` / `[[문서명|별칭]]` 파서 · 역색인 · 그래프 데이터
- `src/components/link-graph.tsx`: react-force-graph-2d 네트워크 뷰 · 카테고리 색 · 클릭 이동
- `src/components/wiki-link-textarea.tsx`: `[[` 자동완성
- Docs 우측(또는 하단) 링크 그래프 패널 · 역링크 · 미리보기 클릭 이동

### 1.0.0 — 2026-07-31 (Phase 9 완료) — `e2d278f`

- 정식 릴리즈 **1.0.0** (Phase 9: 실제 배포 · Vercel/Docker · 도메인/SSL · 롤백)
- **P27** 실제 배포 (`d11e16f`)
  - `vercel.json` rewrites/headers/Cache-Control
  - `.env.production.example` · Dockerfile 최적화 · HEALTHCHECK
  - `docs/DEPLOY.md` · `docs/runbooks/DEPLOY.md` 도메인/SSL/롤백
- README: Phase 1~9 완료 · Vercel Production · Docker 로컬 배포 가이드

### 1.0.0-wip — 2026-07-31 (P27 실제 배포) — `d11e16f`

- `vercel.json`: rewrites(`/health`,`/runtime`) · API no-store · static immutable · 보안 헤더
- `.env.production.example`: Production 환경변수 템플릿
- `docs/DEPLOY.md`: Vercel 단계별 · 커스텀 도메인 · SSL 자동 갱신
- `docs/runbooks/DEPLOY.md`: Dashboard Promote · `vercel rollback` · `git revert`
- Dockerfile: runner apk/wget 제거 · node fetch HEALTHCHECK · dockerignore 강화

### 0.9.0 — 2026-07-30 (Phase 8 완료)

- 정식 릴리즈 **0.9.0** (Phase 8: 모바일 · Slack 인터랙티브 · 위젯 · PWA/오프라인)
- **P25** 모바일·알림·위젯 (`98b838a`)
  - 하단 고정 네비 · 터치 44px · 검색/팀 풀스크린
  - Slack 「확인」 딥링크 · 일지/태스크 상세 알림
  - 대시보드 위젯 3종 · DnD · localStorage
- **P26** 오프라인/PWA (`525422e`)
  - `@ducanh2912/next-pwa` · manifest · CacheFirst/NetworkFirst
  - IndexedDB 미러 · 동기화 큐 · 오프라인 뱃지 · 푸시(동의)
- README: Phase 1~8 완료 · Phase 9 계획 · PWA/오프라인 사용법

### 0.9.0-wip — 2026-07-30 (P26 오프라인/PWA)

- `@ducanh2912/next-pwa` · `public/manifest.json` · standalone · 정적 CacheFirst / API NetworkFirst
- 「홈 화면에 추가」 설치 프롬프트 · 오프라인 헤더 뱃지
- IndexedDB 미러 · 동기화 큐 · 온라인 복구 자동 동기화
- 브라우저 푸시(동의) · 저장/팀 초대/Gate 변경 알림

### 0.9.0-wip — 2026-07-30 (P25 모바일·알림·위젯)

- 모바일 하단 고정 네비 · 터치 타겟 44px · 검색/팀 풀스크린 모달
- Slack Block Kit 「확인」 링크 버튼 · 일지 자동저장/태스크 완료 상세 알림
- 대시보드 위젯 3종 (일지·태스크·Gate) · DnD 순서 · localStorage
- `/?tab=&date=` 딥링크

### 0.8.0 — 2026-07-30 (Phase 7 완료)

- 정식 릴리즈 **0.8.0** (Phase 7: Beacon 양방향 · 자동화/알림)
- **P23** Beacon 양방향 연동 (`b570b5c`)
  - 프로세스 탭: 이름 · Gate · 산출물 → `project.json` Folio 오버레이 (append-only edits)
  - 충돌 감지(mtime) · 병합/재적용 · Docs export · Timeline 동의(기본 off)
- **P24** Beacon 자동화/알림 (`f4e4dce`)
  - 자동 감지 Diff · 헤더 뱃지 · 토스트 · Gate 자동 PASS · 산출물 완료율
  - Docs 저장 시 artifact 자동 생성 · Timeline 주/월·히트맵 분석
- README: Phase 1~7 완료 · Phase 8 계획 · Beacon 고도화 사용법

### 0.8.0-wip — 2026-07-30 (P24 Beacon 자동화/알림)

- 프로세스 탭 「자동 감지」 토글 · project.json 변경 시 live Diff · 헤더 뱃지 · 토스트
- 체크리스트 100% → Gate 자동 PASS · 불일치 경고
- Docs 저장 시 카테고리 기반 artifact 자동 생성 · 산출물 완료율 %
- Timeline 분석: 주/월 변경 횟수 · 활동 히트맵 · 소스/카테고리

### 0.8.0-wip — 2026-07-30 (P23 Beacon 양방향)

- 프로세스 탭: 이름 · Gate · 산출물 체크 편집 → `project.json` Folio 오버레이 (append-only edits)
- 충돌 감지(mtime) · 병합/재적용
- Docs 「Beacon으로 export」 → `.beacon/artifacts/folio/<category>/`
- Timeline: 동의 시 Folio 이벤트를 `.beacon/folio-timeline.jsonl` 에 append (기본 off)

### 0.7.0 — 2026-07-29 (Phase 6 완료 · P22)

- 정식 릴리즈 **0.7.0** (Phase 6: 모니터 · Beacon · 런북)
- `docs/runbooks/`: INCIDENT · BACKUP · DEPLOY · UPGRADE
- `GET /api/runtime` — Node/Next 버전 · env 설정 여부 · uptime (시크릿 비노출)
- `npm run runbook:backup` · `runbook:restore` · `runbook:deploy`
- README: Phase 1~6 완료 기록

### 0.7.0-wip — 2026-07-29 (P21 Beacon 고도화)

- `watchBeaconFiles()` · `/api/beacon/mtime` — project.json / beacon.db mtime 변경 감지
- `.beacon/snapshots/` Folio 스냅샷 (수동 · 변경 · 주기) · 비교 Diff
- `beacon-diff.tsx` — project.json / Timeline 추가·삭제·수정 색 구분
- 프로세스 탭: 새로고침 · 마지막 업데이트 · 「업데이트 있음」 뱃지

### 0.7.0-wip — 2026-07-29 (P20 모니터링/알림)

- `src/lib/health-monitor.ts`: checkStorageMode / checkSupabaseConnection / checkBeaconStatus / overallHealth
- `src/components/health-status.tsx`: 헤더 상태 뱃지(정상·클라우드 끊김·Beacon 미연동) + 상세 패널
- 저장 실패 시 Slack/Discord 웹훅 (쿨다운) · 일지 자동저장 실패 토스트+재시도
- README · VERSION Phase 6 / P20 진행 중

### 0.6.0 — 2026-07-29 (Phase 5 완료 · P19)

- 정식 릴리즈 **0.6.0** (Phase 5: 성능 · a11y · 문서 · QA · 배포 자동화)
- `GET /api/health` → `{ status, version, uptime }`
- `vercel.json` Preview/Production · health Cache-Control
- Docker HEALTHCHECK → `/api/health` · compose `env_file` · `FOLIO_VERSION`
- CI: `lint` · `typecheck` · `qa:smoke` · build
- `.github/workflows/deploy.yml` — main 머지 시 Vercel CLI 배포(시크릿 있을 때)
- `docs/env.example` · DEPLOY · README Phase 1~5 / Phase 6

### 0.6.0-wip — 2026-07-29 (P18 통합 QA)

- QA 매트릭스 · `docs/qa-report.md` · README QA 체크리스트
- fix: 미로그인 시 클라우드 저장 모드 비활성
- fix: 일지 날짜 이동 시 미저장 초안 영속
- fix: 문서 전환 시 편집 중 내용 자동 저장
- `scripts/qa-smoke.mjs` · `npm run qa:smoke`

### 0.6.0-wip — 2026-07-29 (P17 문서화)

- docs: GETTING-STARTED, ARCHITECTURE, BEACON, A11Y, API
- examples: basic-usage, team-setup
- README 확장 (소개·기능·빠른시작·가이드·배포·문서·기여)
- `src/lib` JSDoc 보강 · 버전 0.6.0-wip

### 0.5.0 — 2026-07-29 (P16 접근성/UX)

- skip link · main landmark · 탭 전환 포커스
- Journal/Docs aria-live · 필수 입력 · 저장 로딩/에러 재시도
- Board KeyboardSensor + ←/→ 컬럼 이동 · 포커스 강조
- 저장모드/팀 사이드바 Escape · 포커스 트랩
- `@dnd-kit/sortable` · `docs/a11y-checklist.md`

### 0.5.0 — 2026-07-29 (P16 준비)

- P15 완료로 표시 · P16 접근성/UX 구현 계획 문서 추가
- README 작업 관리 갱신

### 0.5.0 — 2026-07-29 (fix: 저장 로컬 선행 · Journal 피드백)

- storage: cloud/beacon **로컬 선행** 저장 · Beacon 원격 타임아웃 단일 5초
- journal: 저장 버튼 `저장 중/저장됨` · 즉시 `saveJournal` + flush
- docs/board: 의도적 저장 시 localStorage flush

### 0.5.0 — 2026-07-29 (P15 성능 최적화 · 확장)

- page: Journal/Docs/Board/Analytics/Team/Beacon 전부 dynamic · Supabase/migrate dynamic import
- storage: cloud/beacon 저장 타임아웃 5초
- layout: next/font `display: swap` · optimizePackageImports에 dnd-kit/supabase 추가
- `scripts/bundle-size.mjs` + `npm run bundle:size`

### 0.5.0 — 2026-07-29 (fix: 패널 버튼 상태 갱신)

- Board: `composing` 상태로 새 태스크/컬럼+ 폼 표시 (`editingId || form.title` 버그 수정)
- Board/Journal/Docs: 낙관적 UI 갱신 후 저장 (저장 I/O 지연 시 버튼 무반응 해소)
- Board 이중 dynamic 제거 · storage cloud/beacon 저장 타임아웃

### 0.5.0 — 2026-07-29 (P15 성능 최적화)

- `@next/bundle-analyzer` + `npm run analyze` / `perf:measure`
- Board: `@dnd-kit` → `board-dnd` dynamic import · Analytics: recharts 분리 lazy 로드
- Slack/Discord/GitHub: 클라이언트·API dynamic import
- localStorage 300ms debounce · Journal autosave 3초 · Supabase 5분 TTL 캐시
- Journal/Docs/Board `React.memo` · lucide/recharts `optimizePackageImports`

### 0.5.0 — 2026-07-29 (Phase 4 완료)

- 정식 릴리즈 **0.5.0**
- Phase 4 완료: P13 배포 · PROCESS 규약 · P14 프로세스 탭 · P14-2 저장 모드 토글
- README: Phase 1~4 완료, Phase 5 계획, Beacon 연동 사용법

### 0.5.0-wip — 2026-07-29 (P14-2 저장 모드 토글)

- `src/lib/storage.ts`: get/setStorageMode, saveWithFallback, Beacon 캐시 API 클라이언트
- 헤더 `StorageModeToggle`: 로컬 / 클라우드 / Beacon (`.beacon` 있을 때만 Beacon 활성)
- Journal/Docs/Board `*WithFallback`이 저장 모드에 따라 분기
- `/api/beacon/available`, `/api/beacon/folio` — Folio 데이터는 `.beacon/cache/folio-*.json`에만 기록
- `BEACON_PROJECT_ROOT` placeholder (`.env.local` / `docs/env.example`)

### 0.5.0-wip — 2026-07-29 (P14 WAL 읽기 수정)

- 서버 `beacon.db` 읽기를 `node:sqlite`로 전환 (WAL 반영). sql.js는 브라우저 폴더 선택용
- `.gitignore`에 `.beacon/` 추가

### 0.5.0-wip — 2026-07-28 (P14 프로세스 탭)

- `src/lib/beacon.ts`: project.json / beacon.db(sql.js) 읽기, Gate·Timeline·산출물 요약
- `src/components/beacon.tsx` + 홈 탭 **프로세스** (Activity)
- `/api/beacon/summary` 서버 FS 읽기, 브라우저 폴더 선택(File System Access) 폴백
- 데이터 없음: 「Beacon 프로젝트를 초기화하세요」

### 0.5.0-wip — 2026-07-28 (프로세스 연동 규약)

- `PROCESS.md`: Beacon 프로젝트 루트 / `.beacon` 경로, 탭 구조, 읽기 전용 원칙
- 향후 연동 순서: project.json → Gate/P0–P4 → Timeline → 산출물 체크리스트
- folio와 beacon-project-os 리포 분리 운영 명시

### 0.4.1-wip — 2026-07-28 (P13 / Phase 4)

- `vercel.json`, 멀티스테이지 `Dockerfile`, `.dockerignore`, `docker-compose.yml`
- `.github/workflows/ci.yml` (lint / typecheck / test / build)
- `docs/DEPLOY.md` 상세 배포·브랜치 전략 가이드

### 0.4.0 — 2026-07-28 (Phase 3 완료)

- Phase 3 마무리: P10 팀 · P11 분석 · P12 외부 연동 포함 정식 릴리즈
- README 배포(Vercel/Docker) · Phase 4 계획 · `docs/env.example` 정리
- lint `--max-warnings 0` 통과, Docker standalone 빌드 지원

### 0.4.0-wip — 2026-07-28 (P12)

- `slack.ts` / `discord.ts` / `github.ts` + `/api/notify`, `/api/github/issues`
- Journal 옵션 알림, Board 완료 알림·GitHub Issue 링크
- 웹훅/토큰 미설정 시 스킵 또는 UI 숨김

### 0.4.0-wip — 2026-07-28 (P11)

- `src/lib/analytics.ts`: 일지/보드 통계 + 기간 조회 + 폴백
- `src/components/analytics.tsx`: 라인/파이/바/히트맵
- Journal 서브탭 일지/통계, Board 서브탭 일정/분석
- `recharts` 의존성, 보드 상태 변경 이벤트 기록

### 0.4.0-wip — 2026-07-28 (P10 / Phase 3)

- `docs/supabase-schema-team.sql`: teams, members, invitations, shared_docs/boards + RLS
- `src/lib/team.ts`: create/invite/accept/list/share API
- 팀 선택 드롭다운 + 팀 관리 사이드바/초대 UI
- Jira: `POST /rest/api/3/search/jql`, createIssue, transitionIssue + API POST

### 0.3.0-wip — 2026-07-28 (P9)

- 태그 클라우드 (Journal/Board 빈도순, 클릭 필터)
- Journal 날짜 범위 + 오늘/이번 주/이번 달 빠른 선택
- 헤더 다크모드 토글 (`folio_theme` localStorage)
- Board 즐겨찾기 (별표 + 상단 섹션)

### 0.2.2 — 2026-07-28 (P8)

- `src/lib/search.ts`: `searchAll` + relevance(제목 > 태그 > 내용)
- `src/components/global-search.tsx`: 탭 상단 검색, 그룹 결과 패널
- 결과 클릭 시 해당 탭 이동 + 상세 포커스
- Cmd/Ctrl+K 검색 포커스

### 0.2.1 — 2026-07-28 (P7)

- `src/lib/obsidian.ts`: frontmatter/파일명 날짜·제목·태그 파싱
- Docs/Journal에 **Obsidian 가져오기** (다중 .md)
- Docs: 카테고리 `Obsidian Import`, 제목 충돌 시 `(2)` suffix
- Journal: 날짜 추출 후 저장, 기존 일자 스킵

### 0.2.0+ — 2026-07-27 (P6)

- `docs/supabase-schema-migration.sql` (user_id + RLS)
- journal/docs/boards 쿼리에 `.eq('user_id', …)` 명시
- 미로그인 localStorage 전용, 로그인 시 클라우드 + 1회 마이그레이션

### 0.2.0+ — 2026-07-27 (P4-3 / Phase 2)

- `/login` Supabase Auth UI (로그인·회원가입·비밀번호 재설정)
- 헤더 로그인 상태 / 로그아웃
- `getUser` / `signIn` / `signUp` / `signOut` 헬퍼

### 0.2.0 — 2026-07-27 (Phase 1 완료)

- Phase 1 기능 세트 마감: P1~P5
- 코드 정리(불필요 로그 제거, lint 통과), package.json 0.2.0

#### Phase 1 요약

- **P1** Board DnD 컬럼 이동
- **P2** Journal 태그 자동완성
- **P3** Docs 마크다운 프리뷰(편집/미리보기/분할)
- **P4** Supabase 연동(스키마, UI 우선 저장 + localStorage 폴백)
- **P5** Jira 이슈 fetch·Board 동기화·카드 외부 링크

### 0.2.0-wip — 2026-07-27 (P5)

- `src/lib/jira.ts` Jira Cloud REST 클라이언트 (fetch/create/transition)
- `GET /api/jira/issues` 서버 프록시
- Board **Jira 동기화** 버튼 + 카드 Jira 키/외부 링크
- `.env.local` Jira placeholder

### 0.2.0-wip — 2026-07-27 (P4-2)

- `docs/supabase-schema.sql` (journals / docs / boards + RLS + 인덱스)
- UI 저장: Supabase 우선, 실패 시 localStorage 폴백
- UI 로드: Journal은 local→Supabase(우선), Docs/Board는 Supabase→local 폴백
- `@supabase/auth-ui-react` 추가 (로그인 UI 준비)

### 0.2.0-wip — 2026-07-27 (P4)

- `@supabase/ssr`, `@supabase/supabase-js` 추가
- `.env.local` placeholder + `.gitignore`에 `.env.local` 명시
- `src/lib/supabase.ts` 브라우저/서버 클라이언트
- journal/docs/board에 localStorage 유지 + `*Supabase` 함수 추가

### 0.1.1 — 2026-07-27

- Folio 텍스트 로고 / project records 서브타이틀
- 헤더 우측: 프로젝트의 기록
- 탭명: 일지 · 문서 · 일정
- 푸터: Folio · 브라우저에 저장되는 개인 워크스페이스
- README 작업 관리 섹션 및 VERSION.md 추가

### 0.1.0 — 2026-07-27

- Folio 워크스페이스 초기 구성 (일지 / 문서 / 일정)
- Board DnD, Journal 태그 자동완성, Docs 마크다운 프리뷰
- localStorage hydration mismatch 수정
