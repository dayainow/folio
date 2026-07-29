# 팀 초대 · 공유 예시 (Team setup)

Supabase Auth + 팀 스키마가 적용된 환경에서 팀을 만들고 멤버를 초대하는 흐름.

## 사전 준비

1. `.env.local`에 Supabase URL / anon key
2. SQL 적용:
   - `docs/supabase-schema.sql` (또는 migration)
   - `docs/supabase-schema-team.sql`
3. Auth Redirect URL에 `http://localhost:3000/**` 등록
4. `npm run dev` → **로그인** (`/login`)

## 1. 팀 생성

1. 로그인 후 헤더 **팀** 영역 → 관리 열기
2. **새 팀** 이름 입력 → 생성
3. 활성 팀이 헤더에 표시되는지 확인

코드 관점 (`src/lib/team.ts`):

```ts
const team = await createTeam('코어 스쿼드')
setActiveTeamId(team.id)
```

## 2. 멤버 초대

1. 팀 관리에서 초대 이메일 · 역할(admin/member) 입력
2. 초대 생성 → 토큰/링크를 상대에게 전달 (UI의 초대 목록)
3. 상대가 로그인 후 초대를 수락하면 `acceptInvite(token)` 경로로 멤버십 추가

```ts
await inviteMember(teamId, 'dev@example.com', 'member')
// 초대받은 사용자
await acceptInvite(token)
```

## 3. 공유 (문서 · 보드)

팀 컨텍스트가 활성화된 상태에서 공유 API를 쓸 수 있다.

```ts
await shareDoc(teamId, docId, 'edit')   // view | edit
await shareBoard(teamId, boardId, 'view')
const docs = await listSharedDocs(teamId)
const boards = await listSharedBoards(teamId)
```

UI는 팀 사이드바 · 초대 컴포넌트(`TeamInvite`)를 통해 노출된다.

## 4. 저장 모드와 팀

- **클라우드** 모드 + 로그인: 개인 `user_id` 데이터와 팀 RLS가 함께 동작
- **로컬** 모드: 브라우저에만 저장 — 팀 공유와 무관
- 멤버 제거: owner/admin만 `removeMember(teamId, userId)`

## 문제 해결

| 증상 | 확인 |
|------|------|
| 팀 목록 비어 있음 | 로그인 · schema-team 적용 · RLS |
| 초대 실패 | 이메일 형식 · 권한(owner/admin) |
| Escape로 패널 안 닫힘 | P16 포커스 트랩 — Escape 지원됨 |

## 관련

- [API.md](../docs/API.md) — `team` 섹션
- [GETTING-STARTED.md](../docs/GETTING-STARTED.md)
- [basic-usage.md](./basic-usage.md)
