# Folio

프로젝트의 기록을 남기는 개발자 워크스페이스.

## Pages

- 일지 (Journal): 날짜별 업무 일지, 태그, 자동 저장, 날짜 범위 필터, 통계, Slack/Discord 알림(옵션)
- 문서 (Docs): 공통 문서, 카테고리, 검색, 마크다운 프리뷰
- 일정 (Board): 칸반 + Jira/GitHub + 즐겨찾기 + 분석 + 완료 알림
- 로그인 (`/login`): Supabase Auth UI
- 팀: 초대·멤버·공유 (P10)

## 스택

- Next.js 16 + React 19
- Tailwind v4 + shadcn/ui
- localStorage + Supabase (user_id 분리, 팀 RLS)
- Jira / GitHub / Slack / Discord 웹훅

## 시작

```bash
npm run dev
# http://localhost:3000
```

환경변수 예시는 [docs/env.example](./docs/env.example)를 참고해 `.env.local`에 복사한다.

### Supabase (P4 / P6 / P10)

1. `.env.local`에 프로젝트 URL / anon key를 넣는다.
2. [docs/supabase-schema.sql](./docs/supabase-schema.sql) 또는 [docs/supabase-schema-migration.sql](./docs/supabase-schema-migration.sql) 실행.
3. 팀 기능은 [docs/supabase-schema-team.sql](./docs/supabase-schema-team.sql) 추가 실행.
4. 로그인 사용자 데이터는 `user_id`로 분리 (RLS). 미로그인은 localStorage.
5. `/login`에서 이메일 로그인·회원가입·비밀번호 재설정.

### Jira (P5 / P10)

1. `JIRA_API_TOKEN`, `JIRA_EMAIL`, `JIRA_DOMAIN`, `JIRA_PROJECT_KEY`
2. 일정 탭 **Jira 동기화** (`POST /rest/api/3/search/jql`)

### Slack / Discord / GitHub (P12)

1. `SLACK_WEBHOOK_URL` / `DISCORD_WEBHOOK_URL` — 없으면 알림 조용히 스킵
2. 일지: 「저장 시 Slack/Discord 알림」 체크 후 저장
3. 보드: 「완료 시 알림」 체크 시 Done 전환 알림
4. `GITHUB_TOKEN` + `GITHUB_REPO` (`owner/repo`) — 없으면 GitHub 버튼 숨김
5. 보드 카드 **GitHub** 으로 Issue 생성·링크

## License

private

## 작업 관리

- 현재 Phase: Phase 3 (팀 협업, 고급 분석, 외부 연동)
- 진행 중: P12 외부 연동
- 완료: Phase 1~3 P11 (P1~P11)
- 다음: Phase 3 마무리

상세 이력은 [VERSION.md](./VERSION.md)를 참고하세요.
