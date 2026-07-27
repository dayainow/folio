# Folio 버전 / 작업 이력

커밋·푸시할 때마다 이 문서와 `README.md`의 **작업 관리** 섹션을 함께 갱신한다.

## 현재

| 항목 | 값 |
|------|-----|
| 버전 | 0.2.0-wip |
| Phase | Phase 1 (기본 기능) |
| 진행 중 | P4 Supabase 연동 |
| 다음 | P5 Jira 연동 |

## 완료 항목

| ID | 요약 | 커밋 |
|----|------|------|
| P1 | Board 칸반 카드 드래그 앤 드롭 | `9f71420` |
| P2 | Journal 태그 자동완성 | `99b5ef2` |
| P3 | Docs 마크다운 프리뷰 (편집/미리보기/분할) | `2ba620f` |
| P3.1 | Folio 브랜딩 + README 작업 관리 | `c02fade` |

## 진행 중

| ID | 요약 | 노트 |
|----|------|------|
| P4 | Supabase 연동 | 클라이언트/env 스캐폴드 + `*Supabase` API 추가. UI 전환·스키마는 후속 |

## 변경 이력

### 0.2.0-wip — 2026-07-27

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
