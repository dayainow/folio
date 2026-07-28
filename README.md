# Folio

프로젝트의 기록을 남기는 개발자 워크스페이스. **v0.5.0-wip** (Phase 4 + Beacon)

## Pages

- 일지 (Journal): 날짜별 업무 일지, 태그, 자동 저장, 날짜 범위 필터, 통계, Slack/Discord 알림(옵션)
- 문서 (Docs): 공통 문서, 카테고리, 검색, 마크다운 프리뷰
- 일정 (Board): 칸반 + Jira/GitHub + 즐겨찾기 + 분석 + 완료 알림
- **프로세스**: Beacon `.beacon` 읽기 전용 (Gate / Timeline / 산출물)
- 로그인 (`/login`): Supabase Auth UI
- 팀: 초대·멤버·공유
- 통합 검색: ⌘/Ctrl+K

## 스택

- Next.js 16 + React 19
- Tailwind v4 + shadcn/ui
- localStorage + Supabase (user_id 분리, 팀 RLS)
- Jira / GitHub / Slack / Discord 웹훅

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

- 현재 Phase: Phase 4 (배포·상태 저장·성능·문서화) + Beacon 프로세스 연동
- 완료: Phase 1~3 (P1~P12), P13 배포 자동화, 프로세스 연동 규약 (`PROCESS.md`)
- 진행 중: **P14 프로세스 탭 UI** (project.json · Gate · Timeline · 산출물)
- 다음: 상태 기반 저장 토글, 성능/접근성, 문서화 강화

상세 이력은 [VERSION.md](./VERSION.md), 연동 규약은 [PROCESS.md](./PROCESS.md)를 참고하세요.

## Phase 4 계획

- P13 배포 자동화 (Vercel / Docker / CI) ✅
- 프로세스 연동 규약 정리 (folio ↔ beacon-project-os) ✅
- **P14 프로세스 탭** (읽기 전용 `.beacon` 임베딩) ← 진행 중
- 상태 기반 저장 — 로컬/클라우드 전환 토글 UI
- 성능/접근성 — 캐시, 로딩, 키보드 네비게이션
- 문서화 강화 — API 문서, 사용자 가이드
