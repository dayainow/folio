# Folio 데이터 마이그레이션 (P54)

버전 스키마 마이그레이션 · SQLite/JSON 덤프 · 롤백 · 무결성 검증.

## 진입점

- UI: 사이드바 **마이그레이션** (`DataMigrationButton`)
- API: `src/lib/migrate.ts` (로그인 이전 + P54 re-export)
- 코어: `src/lib/data-migration.ts`
- 정의: `src/migrations/*.ts`

## 스키마 버전

| v | 이름 | 내용 |
|---|------|------|
| 1 | baseline | 스키마 버전 태깅 |
| 2 | normalize_tags | 태그 trim/중복 제거 |
| 3 | ensure_timestamps | createdAt/updatedAt · 필수 필드 |

현재 버전: `localStorage.folio_schema_version`

## 기능

| 기능 | 설명 |
|------|------|
| **업그레이드** | `migrateToLatest()` / `runMigrationsTo(n)` |
| **롤백** | 한 단계 down · 직전 스냅샷 복원 |
| **검증** | checksum · 레코드 수 · 이슈 목록 |
| **내보내기** | JSON 데이터셋 · SQLite (`sql.js`) |
| **가져오기** | JSON/SQLite · 충돌: merge / overwrite / skip |
| **리포트** | 마크다운 변환 로그 다운로드 |

## 로그인 마이그레이션

`migrateLocalDataOnLogin()` — 게스트 localStorage → Supabase (기존 동작 유지).
