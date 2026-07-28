# Folio 버전 / 작업 이력

커밋·푸시할 때마다 이 문서와 `README.md`의 **작업 관리** 섹션을 함께 갱신한다.

## 현재

| 항목 | 값 |
|------|-----|
| 버전 | 0.2.1 |
| Phase | Phase 2 |
| 진행 중 | P7 Obsidian 연동 |
| 다음 | 고급 검색/필터 |

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

## 진행 중

| ID | 요약 | 노트 |
|----|------|------|
| P7 | Obsidian 연동 | Journals/Docs .md 가져오기, 태그·날짜 파싱 (브라우저 File API) |

## 변경 이력

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
