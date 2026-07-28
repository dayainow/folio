# Folio

프로젝트의 기록을 남기는 개발자 워크스페이스. **v0.4.0** (Phase 1~3 완료)

## Pages

- 일지 (Journal): 날짜별 업무 일지, 태그, 자동 저장, 날짜 범위 필터, 통계, Slack/Discord 알림(옵션)
- 문서 (Docs): 공통 문서, 카테고리, 검색, 마크다운 프리뷰
- 일정 (Board): 칸반 + Jira/GitHub + 즐겨찾기 + 분석 + 완료 알림
- 로그인 (`/login`): Supabase Auth UI
- 팀: 초대·멤버·공유
- 통합 검색: ⌘/Ctrl+K

## 스택

- Next.js 16 + React 19
- Tailwind v4 + shadcn/ui
- localStorage + Supabase (user_id 분리, 팀 RLS)
- Jira / GitHub / Slack / Discord 웹훅

## 시작

```bash
cp docs/env.example .env.local   # 값 채우기
npm install
npm run dev
# http://localhost:3000
```

환경변수 설명은 [docs/env.example](./docs/env.example)를 참고한다.

### Supabase

1. `.env.local`에 URL / anon key
2. [docs/supabase-schema.sql](./docs/supabase-schema.sql) 또는 [docs/supabase-schema-migration.sql](./docs/supabase-schema-migration.sql)
3. 팀: [docs/supabase-schema-team.sql](./docs/supabase-schema-team.sql)

### Jira / Slack / Discord / GitHub

[docs/env.example](./docs/env.example)의 해당 섹션을 채운다. 웹훅·토큰이 없으면 관련 기능은 스킵되거나 UI에서 숨겨진다.

## 배포

### Vercel

1. GitHub 저장소를 [Vercel](https://vercel.com)에 Import
2. Environment Variables에 `docs/env.example` 목록을 등록 (서버 전용 키는 Production/Preview에만)
3. Deploy — Next.js 기본 설정으로 동작
4. Supabase Auth Redirect URL에 `https://<project>.vercel.app/**` 추가

```bash
npx vercel          # 미리보기
npx vercel --prod   # 프로덕션
```

### Docker

```bash
docker build -t folio .
docker run --rm -p 3000:3000 --env-file .env.local folio
```

이미지는 Next.js `output: 'standalone'` 빌드를 사용한다. (`Dockerfile` 참고)

## License

private

## 작업 관리

- 현재 Phase: **Phase 1~3 완료** (v0.4.0)
- 진행 중: 없음
- 완료: P1~P12 (Board DnD, 태그, 마크다운, Supabase/Auth, Jira, 멀티유저, Obsidian, 검색, 고급 UX, 팀, 분석, 외부 연동)
- 다음: Phase 4 (아래)

상세 이력은 [VERSION.md](./VERSION.md)를 참고하세요.

## Phase 4 계획

- 실시간 협업 (Presence, 공유 보드 동시 편집)
- 모바일/PWA, 오프라인 동기화 고도화
- 알림 규칙 엔진 (필터·스케줄)
- AI 일지 요약 / 보드 추천
- 관리자 콘솔·감사 로그
