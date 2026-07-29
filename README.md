# Folio

프로젝트의 기록을 남기는 개발자 워크스페이스. **v0.5.0** (Phase 4 완료)

## Pages

- 일지 (Journal): 날짜별 업무 일지, 태그, 자동 저장, 날짜 범위 필터, 통계, Slack/Discord 알림(옵션)
- 문서 (Docs): 공통 문서, 카테고리, 검색, 마크다운 프리뷰
- 일정 (Board): 칸반 + Jira/GitHub + 즐겨찾기 + 분석 + 완료 알림
- **프로세스**: Beacon `.beacon` 읽기 전용 (Gate / Timeline / 산출물)
- 로그인 (`/login`): Supabase Auth UI
- 팀: 초대·멤버·공유
- 통합 검색: ⌘/Ctrl+K
- 저장 모드: 헤더에서 로컬 / 클라우드 / Beacon 전환

## 스택

- Next.js 16 + React 19
- Tailwind v4 + shadcn/ui
- localStorage + Supabase (user_id 분리, 팀 RLS)
- Jira / GitHub / Slack / Discord 웹훅
- Beacon 프로세스 연동 (읽기 전용 + Folio 캐시)

## 시작 (로컬)

```bash
cp docs/env.example .env.local   # 값 채우기
npm install
npm run dev
# http://localhost:3000
```

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

환경변수: [docs/env.example](./docs/env.example)

### Supabase

1. `.env.local`에 URL / anon key
2. [docs/supabase-schema.sql](./docs/supabase-schema.sql) 또는 [docs/supabase-schema-migration.sql](./docs/supabase-schema-migration.sql)
3. 팀: [docs/supabase-schema-team.sql](./docs/supabase-schema-team.sql)

### Jira / Slack / Discord / GitHub

[docs/env.example](./docs/env.example) 참고. 미설정 시 해당 기능은 스킵되거나 UI에서 숨겨진다.

## Beacon 연동 사용법

상세 규약: **[PROCESS.md](./PROCESS.md)**

1. **프로젝트 루트에서 Beacon 초기화** (beacon-project-os CLI)
   ```bash
   beacon init --root /path/to/project
   beacon open --root /path/to/project   # 스캔 → .beacon/beacon.db
   ```
2. **Folio 환경변수** (선택) — `.env.local`
   ```bash
   BEACON_PROJECT_ROOT=/path/to/project
   ```
   미설정 시 `process.cwd()`를 루트로 사용한다.
3. **프로세스 탭** — Gate(P0–P4) · Timeline · 산출물 체크리스트 (읽기 전용)
   - 서버가 `.beacon`을 못 읽으면 「Beacon 프로젝트를 초기화하세요」와 폴더 선택 UI가 뜬다.
4. **저장 모드 Beacon** — 헤더 토글에서 Beacon 선택 시 Journal/Docs/Board는
   `.beacon/cache/folio-*.json`에만 저장한다. `project.json` / `beacon.db` 등 CLI 원본은 수정하지 않는다.

## 배포

상세 가이드: **[docs/DEPLOY.md](./docs/DEPLOY.md)** (브랜치 전략 · 환경변수 · Vercel · Docker · CI)

### Vercel (요약)

1. GitHub 저장소 Import → Framework: Next.js (`vercel.json`)
2. Environment Variables 등록 (`NEXT_PUBLIC_*` + 서버 시크릿)
3. `main` → Production, PR → Preview
4. Supabase Auth Redirect URL 등록

```bash
npx vercel          # Preview
npx vercel --prod   # Production
```

### Docker (요약)

```bash
docker compose up --build
# http://localhost:3000
```

또는 `docker build -t folio . && docker run --rm -p 3000:3000 --env-file .env.local folio`

### CI

`.github/workflows/ci.yml` — `main`/PR 시 lint · typecheck · test · build 자동 실행.

## License

private

## 작업 관리

- 현재 Phase: **Phase 5** (성능·접근성·문서화)
- 완료: Phase 1~4 (v0.5.0), P13 배포, P14/P14-2 Beacon, **P15 성능 최적화**
- 진행 중: **P16 접근성/UX** (키보드 · 포커스 · ARIA · 로딩/에러)
- 다음: 문서화 강화

상세 이력은 [VERSION.md](./VERSION.md), 연동 규약은 [PROCESS.md](./PROCESS.md), a11y 체크는 [docs/a11y-checklist.md](./docs/a11y-checklist.md)를 참고하세요.

## Phase 요약

| Phase | 내용 | 상태 |
|-------|------|------|
| 1 | 기본 Journal / Docs / Board + 브랜딩 | ✅ |
| 2 | Supabase · Auth · Jira · 멀티유저 | ✅ |
| 3 | Obsidian · 검색 · 팀 · 분석 · 외부 알림 | ✅ |
| 4 | 배포 · Beacon 프로세스 · 저장 모드 토글 | ✅ |
| 5 | 성능 · 접근성 · 문서화 강화 | 진행 중 |

## Phase 5 계획

- **P15 성능** — 번들 분석, code splitting, debounce/캐시, React.memo ✅
- **P16 접근성/UX** — 키보드 네비게이션, 포커스·ARIA, 대비 ← 진행 중
- 문서화 — API/환경변수 사용자 가이드, 운영 체크리스트
- (선택) Beacon export API · Vercel 프로세스 연동 고도화

### 성능 측정

```bash
npm run bundle:size           # 주요 패키지·chunk 사이즈
npm run perf:measure          # 의존성·.next 크기 요약
ANALYZE=true npm run analyze  # @next/bundle-analyzer UI
```
