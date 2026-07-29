# Folio

프로젝트의 기록을 남기는 개발자 워크스페이스.  
**Developer workspace for project records.**

| | |
|--|--|
| 버전 | **0.7.0** (Phase 1~6 완료) |
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
| 문서 (Docs) | 마크다운 편집·미리보기·분할, Obsidian 가져오기 |
| 일정 (Board) | 칸반 + 키보드 이동, Jira/GitHub, 즐겨찾기, 분석 |
| 프로세스 | Beacon Gate / Timeline / 산출물 (읽기 전용) |
| 팀 | 초대 · 멤버 · 문서/보드 공유 (Supabase) |
| 검색 | ⌘/Ctrl+K 통합 검색 |
| 저장 모드 | 로컬 / 클라우드 / Beacon |
| 접근성 | 스킵 링크, 키보드, ARIA, 포커스 트랩 (P16) |

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

## 배포 / Deploy

상세: **[docs/DEPLOY.md](./docs/DEPLOY.md)** · 환경변수: [docs/env.example](./docs/env.example)

| 방식 | 요약 |
|------|------|
| Vercel | `main` → Production · PR → Preview (`vercel.json`) |
| Docker | `Dockerfile` 멀티스테이지 · `docker compose up --build` |
| CI | lint · typecheck · `qa:smoke` · build (`.github/workflows/ci.yml`) |
| Deploy | main 푸시 시 Vercel CLI (시크릿 설정 시) 또는 Vercel Git 연동 |
| Health | `GET /api/health` → `{ status, version, uptime }` |

```bash
# Vercel
npx vercel --prod

# Docker
cp docs/env.example .env.local   # 값 채움
docker compose up --build
curl -s http://localhost:3000/api/health
```

브랜치: feature → PR (Preview) → `main` 머지 (Production)

---

## 문서 / Docs

| 문서 | 설명 |
|------|------|
| [GETTING-STARTED](./docs/GETTING-STARTED.md) | 설치 · 실행 · 기본 사용 |
| [ARCHITECTURE](./docs/ARCHITECTURE.md) | 폴더 · 데이터 흐름 · 저장 모드 |
| [BEACON](./docs/BEACON.md) | Beacon 연동 · 경로 · 제약 |
| [DEPLOY](./docs/DEPLOY.md) | Vercel · Docker · 로컬 |
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

- 현재: **Phase 1~6 완료** · **0.7.0** 정식 릴리즈
- 완료: Phase 1~5 (**0.6.0**) · Phase 6 (**P20**~**P22**)
- 진행 중: —
- 다음: 운영 유지보수 · 필요 시 다음 Phase 기획

상세: [VERSION.md](./VERSION.md) · [docs/runbooks/](./docs/runbooks/)

## Phase 요약

| Phase | 내용 | 상태 |
|-------|------|------|
| 1 | Journal / Docs / Board + 브랜딩 | ✅ |
| 2 | Supabase · Auth · Jira · 멀티유저 | ✅ |
| 3 | Obsidian · 검색 · 팀 · 분석 · 알림 | ✅ |
| 4 | 배포 · Beacon · 저장 모드 | ✅ |
| 5 | 성능 · 접근성 · 문서화 · QA · 배포 자동화 | ✅ **0.6.0** |
| 6 | 모니터 · Beacon 고도화 · 운영 런북 | ✅ **0.7.0** |
