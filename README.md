# Folio

프로젝트의 기록을 남기는 개발자 워크스페이스.

## Pages

- 일지 (Journal): 날짜별 업무 일지, 태그, 자동 저장
- 문서 (Docs): 공통 문서, 카테고리, 검색, 마크다운 프리뷰
- 일정 (Board): 칸반 (Backlog, In Progress, Review, Done) + Jira 동기화
- 로그인 (`/login`): Supabase Auth UI

## 스택

- Next.js 16 + React 19
- Tailwind v4 + shadcn/ui
- localStorage + Supabase (user_id 분리, 미로그인 시 폴백)
- Jira Cloud REST API (P5)

## 시작

```bash
npm run dev
# http://localhost:3000
```

### Supabase (P4 / P6)

1. `.env.local`에 프로젝트 URL / anon key를 넣는다.
2. [docs/supabase-schema.sql](./docs/supabase-schema.sql) 또는 기존 DB면 [docs/supabase-schema-migration.sql](./docs/supabase-schema-migration.sql) 실행.
3. 로그인 사용자 데이터는 `user_id`로 분리 (RLS). 미로그인은 localStorage.
4. 로그인 시 로컬(게스트) 데이터를 1회 클라우드로 마이그레이션.
5. `/login`에서 이메일 로그인·회원가입·비밀번호 재설정 (P4-3).

### Jira (P5)

1. `.env.local`에 `JIRA_API_TOKEN`, `JIRA_EMAIL`, `JIRA_DOMAIN`, `JIRA_PROJECT_KEY`를 넣는다.
2. 일정 탭의 **Jira 동기화**로 이슈를 불러온다.
3. 상태 매핑: To Do → backlog, In Progress → in_progress, Review → review, Done → done

## License

private

## 작업 관리

- 현재 Phase: Phase 2 (팀 공유, 고급 기능)
- 진행 중: P6 멀티유저 데이터 분리
- 완료: P1 Board DnD, P2 Journal 태그 자동완성, P3 Docs 마크다운 프리뷰, P4 Supabase 연동, P4-3 Auth UI, P5 Jira 연동
- 다음: Obsidian 연동, 고급 검색/필터

상세 이력은 [VERSION.md](./VERSION.md)를 참고하세요.
