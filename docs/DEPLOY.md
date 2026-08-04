# Folio 배포 가이드

로컬 · Vercel · Docker · 커스텀 도메인 · SSL · CI/CD.  
(P13 도입 · P19 강화 · **P27** 실제 배포 · **1.0.0**)

## 환경변수

| 템플릿 | 용도 |
|--------|------|
| [docs/env.example](./env.example) | 로컬 개발 전체 목록 |
| [.env.production.example](../.env.production.example) | **Production** 배포용 요약 |

| 구분 | 변수 | 노출 | 비고 |
|------|------|------|------|
| App | `FOLIO_VERSION` | 서버 | health `version` 폴백 |
| App | `NEXT_PUBLIC_FOLIO_URL` | 클라이언트 | Slack 딥링크 · 절대 URL |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트 | 빌드·런타임 모두 필요 |
| Jira | `JIRA_*` | 서버만 | `/api/jira/*` |
| Slack | `SLACK_WEBHOOK_URL` | 서버만 | 없으면 알림 스킵 |
| Discord | `DISCORD_WEBHOOK_URL` | 서버만 | 없으면 알림 스킵 |
| GitHub | `GITHUB_TOKEN`, `GITHUB_REPO` | 서버만 | 없으면 UI 숨김 |
| Push | `NEXT_PUBLIC_VAPID_*`, `VAPID_*` | 혼합 | P26 Web Push |
| Beacon | `BEACON_PROJECT_ROOT` | 서버만 | 로컬/자가호스팅 (Vercel 비권장) |

**규칙**

- 시크릿은 절대 `NEXT_PUBLIC_` 로 올리지 않는다.
- Git에 `.env.local` / `.env.production.local` 을 커밋하지 않는다.
- Vercel / Docker / CI 각각에 필요한 값만 주입한다.

---

## 브랜치 전략 (Preview / Production)

| 브랜치 | Vercel | 용도 |
|--------|--------|------|
| `main` | **Production** | 공식 배포, 시크릿 Production 환경 |
| PR / 기타 브랜치 | **Preview** | 기능 검증, Preview 환경 변수 |

```
feature/* ──PR──▶ Preview (*.vercel.app)
                      │
                   merge
                      ▼
                   main ──▶ Production
```

`vercel.json` → `git.deploymentEnabled.main: true` · region `icn1`

---

## Healthcheck

```http
GET /api/health
GET /health          # vercel.json rewrite → /api/health
```

응답 예:

```json
{ "status": "ok", "version": "1.0.0", "uptime": 42, "timestamp": "…" }
```

- Docker `HEALTHCHECK` / Compose `healthcheck` → `/api/health` (node `fetch`)
- Vercel: `/api/*` 에 `Cache-Control: no-store`

---

## 로컬

```bash
cp docs/env.example .env.local
npm install
npm run dev
curl -s http://localhost:3000/api/health
```

품질 검사

```bash
npm run lint && npm run typecheck && npm run qa:smoke && npm run build
```

---

## Vercel 배포 (단계별)

### A. 최초 연결 (1회)

1. [vercel.com](https://vercel.com) 로그인 → **Add New… → Project**
2. GitHub 저장소 `dayainow/folio` Import
3. Framework Preset: **Next.js** (`vercel.json` 자동 인식)
4. Root Directory: `.` (기본)
5. Build / Install: `vercel.json` 의 `buildCommand` / `installCommand` 사용
6. Region: `icn1` (서울) — `vercel.json` 과 맞춤

### B. 환경변수 등록

Project → **Settings → Environment Variables** 에 [.env.production.example](../.env.production.example) 기준으로 등록:

| 변수 | Production | Preview | Development |
|------|------------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_*` | ✅ | ✅ | 선택 |
| `NEXT_PUBLIC_FOLIO_URL` | ✅ (커스텀 도메인) | Preview URL | localhost |
| `FOLIO_VERSION` | ✅ `1.0.0` 등 | 선택 | 선택 |
| `JIRA_*` / 웹훅 / `GITHUB_*` | ✅ 필요 시 | 선택 | 선택 |
| `VAPID_*` | 푸시 사용 시 | 선택 | 선택 |

저장 후 **Redeploy** 해야 빌드 타임 `NEXT_PUBLIC_*` 가 반영된다.

### C. Supabase Auth URL

Supabase Dashboard → Authentication → URL Configuration:

| 항목 | 값 |
|------|-----|
| Site URL | `https://your-domain.com` (또는 `*.vercel.app`) |
| Redirect URLs | `https://your-domain.com/**`, `https://*.vercel.app/**` |

### D. 배포 실행

**Git 연동 (권장)**

1. PR 생성 → Preview URL 확인
2. `main` 머지 → Production 자동 배포
3. Deployments 탭에서 Ready / 로그 확인

**CLI**

```bash
npx vercel link          # 최초 1회
npx vercel               # Preview
npx vercel --prod        # Production
# 또는
npm run runbook:deploy
```

### E. 배포 후 검증

```bash
curl -sS https://<host>/api/health
curl -sS https://<host>/api/runtime
# 브라우저: 로그인 · 일지 저장 · (해당 시) 알림/Beacon
```

### F. `vercel.json` 요약

| 항목 | 내용 |
|------|------|
| rewrites | `/health` → `/api/health`, `/runtime` → `/api/runtime` |
| headers (전체) | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` |
| Cache-Control | `/api/*` `no-store` · `/_next/static/*` `immutable` · `/icons/*` 1d |
| SW | `/sw.js` `no-store` |

---

## 커스텀 도메인 · SSL

### 도메인 연결 (Vercel)

1. Project → **Settings → Domains**
2. 도메인 입력 (예: `folio.example.com` 또는 `example.com`)
3. Vercel이 안내하는 DNS 레코드 추가:
   - **A** → `76.76.21.21` (apex) 또는
   - **CNAME** → `cname.vercel-dns.com` (서브도메인)
4. DNS 전파 후 Domains 상태가 **Valid** 인지 확인
5. `NEXT_PUBLIC_FOLIO_URL` 을 `https://your-domain.com` 으로 갱신 후 Redeploy
6. Supabase Site URL / Redirect 도 동일 도메인으로 수정

### SSL (자동)

- Vercel은 Let’s Encrypt 인증서를 **자동 발급·갱신**한다.
- 별도 인증서 업로드·cron 갱신이 필요 없다.
- HTTPS 강제(HTTP→HTTPS 리다이렉트)도 기본 적용된다.
- 상태가 **Invalid Configuration** 이면 DNS 레코드·프록시(Cloudflare orange cloud 등)를 점검한다.

### Cloudflare 사용 시

- 초기 발급: DNS만 프록시 끄기(회색 구름) 권장 → Valid 후 다시 프록시 가능
- SSL/TLS 모드: **Full (strict)** 권장

---

## Docker

이미지는 Next.js `output: "standalone"` 멀티스테이지 (`Dockerfile`).  
런타임 스테이지는 **standalone + static + public** 만 포함하며, `wget`/추가 apk 없이 `node fetch` 로 HEALTHCHECK 한다.

### 직접 빌드·실행

```bash
docker build -t folio:local \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --build-arg FOLIO_VERSION=2.7.0 \
  .

docker run --rm -p 3000:3000 --env-file .env.local folio:local
curl -s http://localhost:3000/api/health
docker inspect --format='{{.State.Health.Status}}' "$(docker ps -q -f ancestor=folio:local)" 
```

### Compose (권장)

```bash
cp docs/env.example .env.local   # 값 채움
docker compose up --build -d
curl -s http://localhost:3000/api/health
docker compose ps   # healthy 확인
```

이미지 크기 확인:

```bash
docker images folio:local --format '{{.Size}}'
```

---

## CI/CD (GitHub Actions) — P40

| 워크플로우 | 역할 |
|-----------|------|
| `ci.yml` | lint · typecheck · qa:smoke · test · build |
| `deploy.yml` | main 게이트 → Vercel Production → health → 실패 시 자동 롤백 |
| `docker.yml` | multi-stage 빌드 · **GHCR** 푸시 (BuildKit/GHA cache) |
| `rollback.yml` | `vercel rollback` (수동 · deploy 실패 시) |
| `monitor.yml` | 30분마다 `/api/health` · `/api/runtime` |

Secrets `VERCEL_TOKEN` · `VERCEL_ORG_ID` · `VERCEL_PROJECT_ID` 가 있으면 CLI Production 배포.  
없으면 **Vercel Git 연동**이 기본 경로 (PR→Preview, `main`→Production).

환경변수 템플릿: [.env.production.example](../.env.production.example) (Dashboard에 **참조 등록**).

---

## 롤백

상세 절차: [docs/runbooks/DEPLOY.md](./runbooks/DEPLOY.md) §6

요약:

| 방법 | 명령 / UI |
|------|-----------|
| Vercel CLI | `npx vercel rollback` |
| Vercel Dashboard | Deployments → 이전 배포 → **Promote to Production** |
| Actions | `Rollback` workflow / deploy 실패 시 자동 |
| Git | `git revert <sha> && git push origin main` |
| GHCR | 이전 `sha-*` 태그로 pull · compose 기동 |

---

## 체크리스트 (P27 · P40)

- [ ] `.env.production.example` 기준으로 Vercel Production env 등록
- [ ] Production Branch = `main` · (선택) Deployment Protection
- [ ] Supabase 스키마 · Auth Redirect URL
- [ ] Preview 스모크 → `main` 머지
- [ ] `GET /api/health` · `/api/runtime` OK
- [ ] (선택) `FOLIO_PRODUCTION_URL` 시크릿 → Monitor/Deploy health
- [ ] (선택) 커스텀 도메인 Valid + SSL
- [ ] (선택) Docker/GHCR 이미지 build · healthy
- [ ] 롤백 경로 숙지 (`vercel rollback` / Actions Rollback / Promote)

---

관련: [GETTING-STARTED.md](./GETTING-STARTED.md) · [runbooks/DEPLOY.md](./runbooks/DEPLOY.md) · [BEACON.md](./BEACON.md)
