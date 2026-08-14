# Folio 시작하기 (Getting Started)

Folio는 브라우저에 저장되는 개인·팀 워크스페이스다. 일지 · 문서 · 칸반 · Beacon 프로세스 탭을 제공한다.

## 요구 사항

- Node.js 20+ 권장
- npm 10+
- (선택) Supabase 프로젝트, Beacon CLI, Jira/GitHub/Slack/Discord

## 설치 · 실행

```bash
git clone https://github.com/dayainow/folio.git
cd folio
cp docs/env.example .env.local   # 값 채우기
npm install
npm run dev
# http://localhost:3456
```

품질 검사:

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

## 환경변수 (최소)

| 변수 | 필수 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 클라우드/로그인 시 | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라우드/로그인 시 | anon key |
| `BEACON_PROJECT_ROOT` | 선택 | Beacon 프로젝트 루트 (기본: `cwd`) |

전체 목록: [env.example](./env.example)

Supabase 스키마:

1. [supabase-schema.sql](./supabase-schema.sql) 또는 migration
2. 팀: [supabase-schema-team.sql](./supabase-schema-team.sql)
3. 기존 DB에 통합 수집함 메타데이터 추가: [supabase-schema-intake.sql](./supabase-schema-intake.sql)

## 기본 사용법

1. **일지** — 날짜별 기록, 태그(Enter 추가 / Backspace 삭제), 자동 저장(3초), 저장 버튼
2. **문서** — 마크다운 편집 · 미리보기 · 분할, **수집함**에서 Obsidian/Markdown 분류 가져오기
3. **일정** — 칸반 드래그 또는 ←/→ 키보드 이동, Jira 동기화 · GitHub 이슈(설정 시)
4. **프로세스** — Beacon Gate / Timeline / 산출물 (읽기 전용)
5. **저장 모드** — 헤더에서 `로컬` / `클라우드` / `Beacon` 전환
6. **검색** — ⌘/Ctrl+K 또는 상단 검색창

## 다음 문서

| 문서 | 내용 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 폴더·데이터 흐름·저장 모드 |
| [BEACON.md](./BEACON.md) | Beacon 연동 |
| [DEPLOY.md](./DEPLOY.md) | Vercel / Docker |
| [A11Y.md](./A11Y.md) | 접근성 · 단축키 |
| [API.md](./API.md) | `src/lib` API |
| [../examples/basic-usage.md](../examples/basic-usage.md) | 사용 예시 |
