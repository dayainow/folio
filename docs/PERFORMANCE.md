# Folio 성능 예산 · 관측 (v2.4 / P50)

## 목표

| 지표 | 목표 | 측정 |
|------|------|------|
| First Contentful Paint (로컬 프로덕션) | ≤ 2.0s | `npm run perf:measure` / Lighthouse |
| Largest Contentful Paint | ≤ 3.5s (CI assert ≤ 6s) | Lighthouse CI · Web Vitals |
| INP (FID 후속) | ≤ 200ms good | Web Vitals 대시보드 |
| CLS | ≤ 0.1 good | Web Vitals |
| TTFB | ≤ 800ms good | Web Vitals |
| `.next/static` total (webpack 빌드 후) | ≤ 8 MB | `npm run bundle:size` (**CI fail**) |
| 단일 대형 chunk (경고) | ≤ 500 KB | bundle:size top chunks |
| 초기 라우트 JS (gzip 추정) | ≤ 350 KB | analyzer |

## 런타임 관측 (P50)

사이드바 **성능** 버튼:

- Web Vitals (LCP · INP/FID · CLS · TTFB · FCP)
- API 응답시간 · 에러율 (기간 24h / 7d / 30d)
- 느린 렌더 (`PerfProfiler`)
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
```

## CI

- `bundle:size` + `BUNDLE_BUDGET_FAIL=1` → 예산 위반 시 quality job 실패
- `lhci` → continue-on-error (회귀 신호 · 일시적 불안정 허용)
- 설정: `.lighthouserc.cjs`

## 설계 원칙

- 패널·차트·팀·협업 UI는 `next/dynamic`
- `optimizePackageImports`: lucide, recharts, dnd-kit, supabase, yjs, idb
- 이미지: `OptimizedImage` (`next/image` + 외부/data 폴백)
- 느린 렌더: `PerfProfiler` / `useRenderMark` (dev 경고)
- API: `timedFetch` (CSRF + 타이밍)
- PWA 캐시: 정적 CacheFirst · API NetworkFirst

## 회귀 시

1. analyzer로 신규 대형 dep 확인
2. 불필요한 클라이언트 번들 import를 서버/dynamic으로 이동
3. CI `bundle-size` / Lighthouse 로그와 비교
4. 사이드바 **성능**에서 LCP·API p75 확인
