# Folio

프로젝트의 기록을 남기는 개발자 워크스페이스.

## Pages

- 일지 (Journal): 날짜별 업무 일지, 태그, 자동 저장
- 문서 (Docs): 공통 문서, 카테고리, 검색, 마크다운 프리뷰
- 일정 (Board): 칸반 (Backlog, In Progress, Review, Done) + Jira 동기화

## 스택

- Next.js 16 + React 19
- Tailwind v4 + shadcn/ui
- localStorage + Supabase (P4, 실패 시 폴백)
- Jira Cloud REST API (P5)

## 시작

```bash
npm run dev
# http://localhost:3000
```

### Supabase (P4)

1. `.env.local`에 프로젝트 URL / anon key를 넣는다.
2. [docs/supabase-schema.sql](./docs/supabase-schema.sql)을 SQL Editor에서 실행한다.
3. UI는 Supabase 저장을 우선하고, 실패 시 localStorage로 폴백한다.

### Jira (P5)

1. `.env.local`에 `JIRA_API_TOKEN`, `JIRA_EMAIL`, `JIRA_DOMAIN`, `JIRA_PROJECT_KEY`를 넣는다.
2. 일정 탭의 **Jira 동기화**로 이슈를 불러온다.
3. 상태 매핑: To Do → backlog, In Progress → in_progress, Review → review, Done → done

## License

private

## 작업 관리

- 현재 Phase: Phase 1 (기본 기능)
- 진행 중: P4 Supabase 연동, P4-2 Supabase DB 스키마 + UI 전환, P5 Jira 연동
- 완료: P1 Board DnD, P2 Journal 태그 자동완성, P3 Docs 마크다운 프리뷰, P3.1 Folio 브랜딩
- 다음: -

상세 이력은 [VERSION.md](./VERSION.md)를 참고하세요.
