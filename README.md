# Folio

프로젝트의 기록을 남기는 개발자 워크스페이스.

## Pages

- 일지 (Journal): 날짜별 업무 일지, 태그, 자동 저장, 날짜 범위 필터
- 문서 (Docs): 공통 문서, 카테고리, 검색, 마크다운 프리뷰
- 일정 (Board): 칸반 + Jira 동기화 + 즐겨찾기
- 로그인 (`/login`): Supabase Auth UI
- 팀: 초대·멤버·공유 (P10)

## 스택

- Next.js 16 + React 19
- Tailwind v4 + shadcn/ui
- localStorage + Supabase (user_id 분리, 팀 RLS)
- Jira Cloud REST API (`/rest/api/3/search/jql`)

## 시작

```bash
npm run dev
# http://localhost:3000
```

### Supabase (P4 / P6 / P10)

1. `.env.local`에 프로젝트 URL / anon key를 넣는다.
2. [docs/supabase-schema.sql](./docs/supabase-schema.sql) 또는 [docs/supabase-schema-migration.sql](./docs/supabase-schema-migration.sql) 실행.
3. 팀 기능은 [docs/supabase-schema-team.sql](./docs/supabase-schema-team.sql) 추가 실행.
4. 로그인 사용자 데이터는 `user_id`로 분리 (RLS). 미로그인은 localStorage.
5. `/login`에서 이메일 로그인·회원가입·비밀번호 재설정.

### Jira (P5 / P10)

1. `.env.local`에 `JIRA_API_TOKEN`, `JIRA_EMAIL`, `JIRA_DOMAIN`, `JIRA_PROJECT_KEY`를 넣는다.
2. 일정 탭의 **Jira 동기화**로 이슈를 불러온다 (`POST /rest/api/3/search/jql`).
3. API: `GET/POST /api/jira/issues` (조회·생성·transition).
4. 상태 매핑: To Do → backlog, In Progress → in_progress, Review → review, Done → done

## License

private

## 작업 관리

- 현재 Phase: Phase 3 (팀 협업, 고급 분석, 외부 연동)
- 진행 중: P10 팀 초대/공유
- 완료: Phase 1~2 (P1~P9)
- 다음: 고급 분석, Slack/Discord·GitHub 연동

상세 이력은 [VERSION.md](./VERSION.md)를 참고하세요.
