# Folio 성능 예산 (v2.0)

## 목표

| 지표 | 목표 | 측정 |
|------|------|------|
| First Contentful Paint (로컬 프로덕션) | ≤ 2.0s | `npm run perf:measure` / Lighthouse |
| Largest Contentful Paint | ≤ 3.5s | Lighthouse |
| `.next/static` total (webpack 빌드 후) | ≤ 8 MB | `npm run bundle:size` |
| 단일 대형 chunk (경고) | ≤ 500 KB | bundle:size top chunks |
| 초기 라우트 JS (gzip 추정) | ≤ 350 KB | analyzer |

## 명령

```bash
npm run build
npm run bundle:size
ANALYZE=true npm run analyze   # 브라우저에서 treemap
npm run perf:measure
```

## 설계 원칙

- 패널·차트·팀·협업 UI는 `next/dynamic`
- `optimizePackageImports`: lucide, recharts, dnd-kit, supabase, yjs, idb
- 이미지: SVG 원격 금지 (`dangerouslyAllowSVG: false`)
- PWA 캐시: 정적 CacheFirst · API NetworkFirst

## 회귀 시

1. analyzer로 신규 대형 dep 확인
2. 불필요한 클라이언트 번들 import를 서버/dynamic으로 이동
3. CI `bundle-size` 스텝 로그와 비교
