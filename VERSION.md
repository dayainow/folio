# Folio 버전 / 작업 이력

커밋·푸시할 때마다 이 문서와 `README.md`의 **작업 관리** 섹션을 함께 갱신한다.

## 현재

| 항목 | 값 |
|------|-----|
| 버전 | 0.4.0-wip |
| Phase | Phase 3 |
| 진행 중 | P11 고급 분석 |
| 다음 | Slack/Discord 알림, GitHub 연동 |

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

## 진행 중

| ID | 요약 | 노트 |
|----|------|------|
| P11 | 고급 분석 | Journal/Board 차트 (recharts), 기간 필터 |

## 변경 이력

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
