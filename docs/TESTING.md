# Folio 테스트 가이드 (v2.0)

## 실행

```bash
npm run test          # vitest run (CI)
npm run test:watch    # 감시 모드
npm run qa:smoke      # 핵심 로직 스모크 (단위 테스트와 별개)
```

## 스택

| 도구 | 용도 |
|------|------|
| Vitest 3 | 러너 |
| happy-dom | DOM/localStorage |
| @testing-library/* | 컴포넌트/DOM (필요 시) |

설정: `vitest.config.ts` · `vitest.setup.ts`

## 파일 위치

```
src/lib/__tests__/*.test.ts
src/components/__tests__/*.test.tsx
```

권장: 순수 유틸은 lib, UI 동작은 components.

## 무엇을 테스트하나

**우선**

- storage 모드 · env 검증
- collab diff / Yjs 병합
- analytics 스코어
- export MD/CSV/JSON/ZIP
- journal/board 로컬 저장·상태 이동
- sanitize / deep link / wiki-link

**나중 (모킹)**

- Supabase 네트워크
- Realtime Presence 세션
- 전체 `JournalPanel` E2E (Playwright 등)

## 작성 규칙

1. 외부 I/O는 mock (`vi.stubEnv`, `localStorage.clear`)
2. 테스트 이름은 동작/기대 결과를 드러냄
3. flaky timer는 `vi.useFakeTimers`
4. `console.error`를 검증하는 테스트는 spy로 소음 억제 가능
5. PR에 `npm run test` 통과를 적음

## CI

- `.github/workflows/test.yml` — unit
- `.github/workflows/lint.yml` — lint + typecheck
- `.github/workflows/ci.yml` — 통합 품질 게이트 (lint · typecheck · test · qa:smoke · build)

## 커버리지 (선택)

```bash
npx vitest run --coverage
```

(추가 설정 시 `@vitest/coverage-v8` 필요)
