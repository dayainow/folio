# Folio 테스트 가이드 (v4.0 / P66)

## 실행

```bash
npm run test              # vitest run (CI)
npm run test:watch        # 감시 모드
npm run test:coverage     # 커버리지 + 80% 게이트
npm run test:e2e          # Playwright (빌드/서버 필요 · webServer 자동)
npm run test:visual       # Playwright 시각 스냅샷
npm run qa:smoke          # 핵심 로직 스모크
npm run storybook         # Storybook UI
npm run build-storybook   # 정적 스토리 빌드
npm run chromatic         # Chromatic 시각 회귀 (토큰 필요)
npm run lhci              # Lighthouse CI
```

## 스택

| 도구 | 용도 |
|------|------|
| Vitest 3 + coverage-v8 | 단위 · 커버리지 게이트 |
| happy-dom | DOM/localStorage |
| @testing-library/* | 컴포넌트/DOM |
| Playwright | E2E · 시각 스냅샷 |
| Storybook 8 + Chromatic | 컴포넌트 카탈로그 · 시각 회귀 |
| Lighthouse CI | 성능 회귀 |

설정: `vitest.config.ts` · `vitest.setup.ts` · `playwright.config.ts` · `.storybook/` · `.lighthouserc.cjs`

## 파일 위치

```
src/lib/__tests__/*.test.ts
src/components/__tests__/*.test.tsx
src/**/*.stories.tsx
e2e/*.spec.ts
```

## 커버리지 (P66)

- 게이트 대상 코어 모듈(`vitest.config.ts` `COVERAGE_CORE`) 평균 **lines/statements ≥ 80%** (현재 ~91%)
- 대상: theme · errors · perf-* · jspdf-loader · debounce · sanitize · shortcuts · plugins 등
- 전체 `src/lib`은 점진 확대 (외부 연동·브라우저 I/O 제외)
- CI: `npm run test:coverage` **hard gate**

## E2E (Playwright)

| 스펙 | 범위 |
|------|------|
| `e2e/a11y-smoke.spec.ts` | landmark · ⌘K · 고대비 |
| `e2e/core-flows.spec.ts` | 로그인 진입점 · 일지 · 문서 · 보드 DnD 컬럼 · 팔레트 |
| `e2e/visual-regression.spec.ts` | 홈 배너 스냅샷 (Chromatic 병행) |

```bash
npm run build && npm run test:e2e
# 스냅샷 갱신
npx playwright test e2e/visual-regression.spec.ts --update-snapshots
```

## Storybook / Chromatic

```bash
npm run storybook
CHROMATIC_PROJECT_TOKEN=... npm run chromatic
```

GitHub Actions는 `CHROMATIC_PROJECT_TOKEN` 시크릿이 있을 때만 실행.

## 작성 규칙

1. 외부 I/O는 mock (`vi.stubEnv`, `localStorage.clear`)
2. 테스트 이름은 동작/기대 결과를 드러냄
3. flaky timer는 `vi.useFakeTimers`
4. E2E는 인증 없이도 통과하도록 soft 폴백 허용
5. PR에 `npm run test` · `test:coverage` 통과를 적음

## CI

- `.github/workflows/ci.yml` — lint · typecheck · test · **coverage** · qa:smoke · build · bundle-size · (optional) e2e/lhci/chromatic
