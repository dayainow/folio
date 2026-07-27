# Folio

프로젝트의 기록을 남기는 개발자 워크스페이스.

## Pages

- 일지 (Journal): 날짜별 업무 일지, 태그, 자동 저장
- 문서 (Docs): 공통 문서, 카테고리, 검색, 마크다운 프리뷰
- 일정 (Board): 칸반 (Backlog, In Progress, Review, Done)

## 스택

- Next.js 16 + React 19
- Tailwind v4 + shadcn/ui
- localStorage 기반 로컬 저장 (P4에서 Supabase 병행 준비)

## 시작

```bash
npm run dev
# http://localhost:3000
```

### Supabase (P4)

1. `.env.local`에 프로젝트 URL / anon key를 넣는다 (placeholder 기본값 제공).
2. `src/lib/supabase.ts`의 브라우저·서버 클라이언트를 사용한다.
3. UI는 아직 localStorage를 쓰고, `*Supabase` 함수로 원격 저장 API를 준비해 두었다.

## License

private

## 작업 관리

- 현재 Phase: Phase 1 (기본 기능)
- 진행 중: P4 Supabase 연동
- 완료: P1 Board DnD, P2 Journal 태그 자동완성, P3 Docs 마크다운 프리뷰, P3.1 Folio 브랜딩
- 다음: P5 Jira 연동

상세 이력은 [VERSION.md](./VERSION.md)를 참고하세요.
