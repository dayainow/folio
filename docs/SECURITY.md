# Folio 고급 보안 (P49)

## 기능 요약

| 영역 | 내용 |
|------|------|
| **2FA** | Supabase MFA TOTP (`auth-mfa.ts`) · 사이드바 **보안** 패널 |
| **SSO** | OAuth (`google,github,…`) · SAML은 Dashboard SSO 설정 |
| **세션** | 다중 세션 추적 · 다른 기기/전체 원격 종료 |
| **RBAC** | 팀 역할 + 리소스 ACL(`view/comment/edit/admin/owner`) + 프로젝트 격리 |
| **감사** | `security-audit` CRUD/auth/ACL/export/GDPR 로그 |
| **GDPR** | 클라우드 삭제 · 익명화 · 로컬 정리 |
| **스캔** | `npm run audit` / `npm run security:scan` |
| **CSP/CSRF** | 강화 CSP · Report-Only · middleware CSRF |

## 설정

```bash
# .env.local
NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS=google,github
# Supabase Dashboard에서 Google/GitHub provider + MFA 활성화
```

## 사용

1. 로그인 화면 — OAuth 버튼 (provider 활성 시)
2. 사이드바 계정 → **보안**
   - 2FA 등록/해제
   - 세션 목록 · 원격 종료
   - 보안 감사 로그
   - GDPR 데이터 삭제

## API CSRF

변경 요청(`POST/PUT/PATCH/DELETE`)은 `folio_csrf` 쿠키와 `x-folio-csrf` 헤더가 일치해야 합니다.  
웹훅(`/api/github/webhook`, `/api/mcp/*`) · health/runtime 은 제외.

클라이언트:

```ts
import { csrfHeaders } from '@/lib/csrf'
await fetch('/api/...', { method: 'POST', headers: { ...csrfHeaders(), 'Content-Type': 'application/json' }, body })
```

## 의존성 스캔

```bash
npm run audit
npm run security:scan   # npm audit + .security-audit.json 산출
```

선택: [Snyk](https://snyk.io) CLI (`snyk test`) 또는 GitHub Dependabot.  
CI `quality` job에 `npm audit --omit=dev --audit-level=high` 스텝이 포함됩니다 (high 이상 실패).
