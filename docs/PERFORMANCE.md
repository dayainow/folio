# Folio 성능 예산 · 관측 (v4.0 / P66)

## 목표

| 지표 | 목표 | 측정 |
|------|------|------|
| First Contentful Paint (로컬 프로덕션) | ≤ 2.0s | `npm run perf:measure` / Lighthouse |
| Largest Contentful Paint | ≤ 3.5s (CI assert ≤ 6s) | Lighthouse CI · Web Vitals |
| INP (FID 후속) | ≤ 200ms good | Web Vitals 대시보드 |
| CLS | ≤ 0.1 good | Web Vitals |
| TTFB | ≤ 800ms good | Web Vitals |
| `.next/static` total (webpack 빌드 후) | ≤ 8 MB | `npm run bundle:size` (**CI fail**) |
| 초기 JS 추정 (main/framework 합) | ≤ 900 KB | bundle:size (**CI fail**) |
| 단일 대형 chunk (경고) | ≤ 500 KB | bundle:size top chunks |
| 초기 라우트 JS (gzip 추정) | ≤ 350 KB | `ANALYZE=true npm run analyze` |

## 런타임 관측 (P50 → P66)

사이드바 **성능** 버튼:

- Web Vitals (LCP · INP/FID · CLS · TTFB · FCP)
- **종합 스코어** (vitals · API · 렌더 가중)
- API 응답시간 · 에러율 (기간 24h / 7d / 30d)
- 느린 렌더 (`PerfProfiler` / `useRenderMark`)
- 임계 초과 시 Slack/Discord/푸시 (`perf-alerts`)

## 명령

```bash
npm run build
npm run bundle:size          # CI에서는 예산 초과 시 실패
BUNDLE_BUDGET_FAIL=1 npm run bundle:size
ANALYZE=true npm run analyze
npm run perf:measure
npm run lhci                 # 빌드 후 Lighthouse CI
npm run perf:regression      # bundle + lhci
npm run storybook            # UI 스토리
npm run chromatic            # 시각 회귀 (토큰 필요)
```

## CI

- `test:coverage` → lib 게이트 평균 **80%** (P66 hard gate)
- `bundle:size` + `BUNDLE_BUDGET_FAIL=1` → static/초기 JS 예산 위반 시 실패
- `lhci` · Playwright · Chromatic → continue-on-error (회귀 신호)
- 설정: `.lighthouserc.cjs`

## 설계 원칙 (P66)

- 패널·차트·팀·협업·내보내기/리포트 UI는 `next/dynamic`
- `jspdf`는 `loadJsPdf()` dynamic import
- `optimizePackageImports`: lucide, recharts, dnd-kit, supabase, yjs, idb, react-window, jspdf
- 긴 목록: `VirtualList` (`react-window`) · 행 `memo`
- 이미지: `OptimizedImage` + AVIF/WebP
- SVG: `public/icons/sprite.svg` + `SpriteIcon`
- API: `timedFetch` (CSRF + 타이밍)

## 회귀 시

1. analyzer로 신규 대형 dep 확인
2. 불필요한 클라이언트 번들 import를 서버/dynamic으로 이동
3. CI `bundle-size` / Lighthouse 로그와 비교
4. 사이드바 **성능**에서 LCP·API p75·종합 스코어 확인
