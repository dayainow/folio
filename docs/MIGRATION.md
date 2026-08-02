# Folio 마이그레이션 가이드 (1.x → 2.0)

## 요약

Folio **2.0.0**은 기능 호환을 유지한 **기반 정비 릴리즈**입니다. 데이터 포맷·저장 모드·탭 UX는 1.8.x와 동일하며, 테스트·보안 헤더·문서·CI가 강화되었습니다.

| 항목 | 호환 |
|------|------|
| localStorage 키 (`workspace_*`, `folio_*`) | ✅ 유지 |
| 저장 모드 local/cloud/beacon | ✅ 유지 (`*WithFallback`) |
| Supabase 스키마 | ✅ 1.x 마이그레이션 SQL 재사용 |
| API 라우트 | ✅ 하위 호환 |
| PWA / MCP | ✅ 유지 |

## 업그레이드 절차

1. **백업**
   ```bash
   npm run runbook:backup
   # 또는 앱에서 전체 내보내기 ZIP
   ```
2. **코드 갱신**
   ```bash
   git pull origin main
   npm ci
   ```
3. **환경변수**
   - `docs/env.example` → `.env.local` 대조
   - `FOLIO_VERSION=2.0.0` (선택, health 표시)
4. **검증**
   ```bash
   npm run lint && npm run typecheck && npm run test && npm run qa:smoke
   npm run build
   ```
5. **배포** — [runbooks/DEPLOY.md](./runbooks/DEPLOY.md) · [runbooks/UPGRADE.md](./runbooks/UPGRADE.md)

## 호환성 주의점

- **CSP 헤더** (`next.config.ts`): 인라인 스크립트는 `'unsafe-inline'` 허용. 커스텀 외부 스크립트 CDN을 쓰면 CSP `script-src`/`connect-src`를 확장해야 합니다.
- **deprecated**: `WidgetDashboard` → `WidgetSidebar` 사용. `createClient` supabase 별칭은 제거됨 → `createBrowserSupabaseClient`.
- **테스트**: `npm run test`가 typecheck 별칭이 아니라 **Vitest**입니다. CI에 unit test 단계가 필수입니다.
- **번들 예산**: [PERFORMANCE.md](./PERFORMANCE.md) — First Load JS / `.next/static` 목표치.
- Vercel `vercel.json` 보안 헤더와 Next `headers()`가 **중복**될 수 있습니다. 동일 정책을 유지하세요.

## 롤백

1. 이전 이미지/배포로 Promote (Vercel) 또는 Docker 태그 롤백
2. 로컬 데이터는 브라우저에 남아 있으므로 보통 스키마 다운그레이드 불필요
3. 2.0에서만 추가한 env는 무시되어도 동작합니다

## 관련 문서

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [TESTING.md](./TESTING.md)
- [VERSION.md](../VERSION.md)
