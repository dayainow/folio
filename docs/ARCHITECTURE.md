# Folio 아키텍처 (Architecture)

## 개요

Folio는 Next.js App Router 클라이언트 중심 앱이다. 데이터는 **저장 모드**에 따라 `localStorage` · Supabase · `.beacon/cache` 중 하나에 기록되며, 원격 실패 시에도 **로컬 선행 저장**으로 UX를 보장한다.

```
UI (page / panels)
    ↓
lib/*WithFallback (journal · docs · board)
    ↓
storage.saveWithFallback / loadWithFallback
    ├── local  → local-cache (debounce + flush)
    ├── cloud  → Supabase (user_id) + 로컬 미러
    └── beacon → /api/beacon/folio → .beacon/cache/folio-*.json
```

## 폴더 구조

```
src/
  app/                 # App Router (page, login, api/*)
  components/          # 패널 · UI · 검색 · 팀
  lib/                 # 도메인 · 저장 · 연동
docs/                  # 사용자·운영 문서
examples/              # 사용 시나리오
scripts/               # 번들/성능 측정
.process / PROCESS.md  # Beacon 규약
```

| 경로 | 역할 |
|------|------|
| `src/app/page.tsx` | 셸 · 탭 · dynamic import |
| `src/components/journal.tsx` 등 | 패널 UI |
| `src/lib/storage.ts` | 저장 모드 단일 진입점 |
| `src/lib/local-cache.ts` | localStorage + 300ms debounce |
| `src/app/api/beacon/*` | Beacon FS 읽기 · Folio 캐시 |

## 데이터 흐름

### Journal / Docs / Board

1. 패널이 `load*WithFallback()` 으로 초기 로드
2. 편집 시 낙관적 UI 갱신
3. `save*WithFallback()` → `saveWithFallback`
   - **항상 로컬 먼저** (`setLocalJson` + `flushLocalJson`)
   - cloud/beacon은 최대 5초 타임아웃 후 `usedFallback`

### Auth · 멀티유저

- `src/lib/supabase.ts` — 브라우저/서버 클라이언트
- 로그인 시 `migrateLocalDataOnLogin()` (로컬 → cloud)
- Supabase 행은 `user_id` 로 분리, 팀은 RLS (`docs/supabase-schema-team.sql`)

### 검색 · 분석

- `searchAll()` — 로컬/모드에 따른 데이터 통합 검색
- `analytics.ts` — Journal/Board 집계 (recharts UI는 dynamic)

## 저장 모드

| 모드 | 읽기 | 쓰기 | 비고 |
|------|------|------|------|
| `local` | localStorage | localStorage | 기본 |
| `cloud` | Supabase → 실패 시 local | 로컬 선행 + Supabase | 로그인 필요 |
| `beacon` | `.beacon/cache` → 없으면 local | 로컬 선행 + cache JSON | `.beacon` 있을 때만 |

모드 키: `localStorage['folio_storage_mode']`  
토글: 헤더 `StorageModeToggle`

## Beacon 경계

- Folio는 `project.json` / `beacon.db` 등 **CLI 원본을 쓰지 않는다**
- Folio 전용 캐시만 `.beacon/cache/folio-{journals,docs,boards}.json`
- 상세: [BEACON.md](./BEACON.md), [PROCESS.md](../PROCESS.md)

## 성능 (P15)

- 패널·차트·팀: `next/dynamic`
- `optimizePackageImports` (lucide, recharts, dnd-kit, supabase)
- Journal autosave 3s, localStorage debounce 300ms
- 측정: `npm run bundle:size` / `perf:measure` / `analyze`
