# 배포 런북 (Deploy)

Vercel · Docker · GHCR · GitHub Actions · 헬스체크 · **롤백**. (P22 · P27 · P40 · **v2.0**)

상세 배경: [docs/DEPLOY.md](../DEPLOY.md) · 환경변수: [.env.production.example](../../.env.production.example) · [docs/env.example](../env.example)

**v2.2 배포 전:** `npm run test` · CSP · [COLLAB-SERVER.md](../COLLAB-SERVER.md) · 저장 관측 env 확인. 태그 `v2.2.0` 푸시 시 Release 워크플로가 노트를 생성합니다.

---

## 1. 브랜치 전략

| 브랜치 | 환경 | 동작 |
|--------|------|------|
| `feature/*` → PR | **Preview** | Vercel Preview URL (미지정 브랜치 기본 배포 ON) |
| `main` | **Production** | Git 연동 + (선택) Actions `deploy.yml` |

```
feature/* ──PR──▶ Preview
                 │ merge
                 ▼
               main ──▶ Production (+ GHCR 이미지)
```

`vercel.json`

- `git.deploymentEnabled.main: true` — Production 브랜치 배포
- 미지정 브랜치: 기본 `true` → **Preview 자동 배포**
- `github.autoJobCancelation: true` — 같은 브랜치 이전 빌드 취소

**Production 보호 (Dashboard)**

1. Settings → **Git** → Production Branch = `main`
2. Settings → **Deployment Protection** (Password / Vercel Auth / Trusted IPs) 필요 시 활성화
3. 환경변수는 Production / Preview를 **분리** 등록 (시크릿은 Preview에 최소화)

---

## 2. 배포 전 체크리스트

- [ ] `npm run lint && npm run typecheck && npm run qa:smoke`
- [ ] `.env.production.example` 기준으로 Production / Preview env 확인
- [ ] Supabase Auth Redirect URL (Production · Preview · 커스텀 도메인)
- [ ] `VERSION.md` · README 작업 관리 갱신
- [ ] (권장) `npm run runbook:backup`

---

## 3. 환경변수 설정

> **소스 오브 트루스:** [.env.production.example](../../.env.production.example)  
> Vercel Dashboard에 값을 직접 입력한다 (파일 업로드가 아니라 **이 템플릿을 참조**).

| 구분 | Vercel | Docker / GHCR |
|------|--------|----------------|
| `NEXT_PUBLIC_*` | Production + Preview | build-arg + runtime |
| `JIRA_*` / 웹훅 / `GITHUB_*` | Production (필요 시 Preview) | `.env.local` / `env_file` |
| `FOLIO_VERSION` | `2.9.0-wip` | Dockerfile ARG / compose |
| `BEACON_PROJECT_ROOT` | 보통 미사용 | 자가호스팅 시 설정 |

### GitHub Actions Secrets (P40)

| Secret | 용도 |
|--------|------|
| `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | CLI 배포 · 롤백 |
| `FOLIO_PRODUCTION_URL` | 배포 후·모니터 헬스체크 |
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `FOLIO_URL` | Docker 이미지 빌드 인자 (선택) |

시크릿은 `NEXT_PUBLIC_` 로 올리지 않는다. `.env*.local` 은 커밋하지 않는다.

---

## 4. 배포 절차

### 4.1 스크립트

```bash
npm run runbook:deploy
# 기본: Vercel production (npx vercel --prod)
# FOLIO_DEPLOY_TARGET=docker 이면 docker compose up --build -d
```

### 4.2 Vercel (권장)

**Git 연동**

1. PR → Preview 자동 배포
2. PR 머지 → `main` push → Production
3. (선택) GitHub Actions `Deploy` — preflight(lint/typecheck/qa/build) 후 `vercel build --prod` + health check
4. 배포 실패 시 `Rollback` 워크플로우 자동 호출

**CLI**

```bash
npx vercel          # Preview
npx vercel --prod   # Production
```

단계별 UI 가이드: [docs/DEPLOY.md](../DEPLOY.md) § Vercel 배포

### 4.3 Docker / GHCR

로컬:

```bash
cp docs/env.example .env.local
docker compose up --build -d
docker compose ps          # State healthy
curl -sS http://localhost:3000/api/health
```

GHCR (Actions `docker.yml`):

```bash
# main 푸시 / v* 태그 → ghcr.io/<owner>/folio:latest|sha-…|1.3.0
docker pull ghcr.io/<owner>/folio:latest
docker run --rm -p 3000:3000 --env-file .env.local ghcr.io/<owner>/folio:latest
```

이미지 최적화 (P40): `package*.json` 선행 COPY · BuildKit npm/`.next` 캐시 · standalone runner · `screenshots/` 컨텍스트 제외.

---

## 5. 헬스체크 · 모니터링

```bash
curl -sS https://<host>/api/health
# {"status":"ok","version":"…",…}

curl -sS https://<host>/health          # rewrite
curl -sS https://<host>/api/runtime
curl -sS https://<host>/runtime
```

| 확인 | 기대 |
|------|------|
| `/api/health` | `status: "ok"` |
| `/api/runtime` | 버전 · env flags (시크릿 값 미노출) |
| 앱 스모크 | 로그인 · 일지 저장 |
| Docker | `health: healthy` |

**Actions**

- `deploy.yml` → `scripts/post-deploy-health.mjs` (배포 직후)
- `monitor.yml` → 30분마다 Production 프로브 (`FOLIO_PRODUCTION_URL`)

```bash
FOLIO_PRODUCTION_URL=https://<host> node scripts/post-deploy-health.mjs
```

---

## 6. 롤백 (상세)

장애·잘못된 배포 시 **가장 빠른 경로를 먼저** 사용한다. (데이터 마이그레이션이 포함된 경우 INCIDENT 런북도 병행)

### 6.1 Vercel Dashboard (권장 · 즉시)

1. [Vercel Dashboard](https://vercel.com) → 프로젝트 → **Deployments**
2. 현재 Production 배포 아래의 **직전 정상 배포** 선택
3. ⋯ 메뉴 → **Promote to Production** (또는 Redeploy)
4. 배포 완료 후:

```bash
curl -sS https://<production-host>/api/health
```

5. 앱 스모크 (로그인 · 핵심 저장 경로)
6. 팀에 롤백 완료·원인 공유

### 6.2 Vercel CLI

```bash
# 프로젝트 루트에서 (vercel link 되어 있어야 함)
npx vercel rollback

# 특정 배포 URL/ID 지정 (Dashboard Deployments 목록 참고)
npx vercel rollback <deployment-url-or-id>
```

롤백 후 동일하게 `/api/health` · 스모크 확인.

> `vercel rollback` 은 **Production** 을 이전 배포로 되돌린다.  
> Preview만 잘못된 경우 해당 PR을 닫거나 수정 커밋으로 재배포하면 된다.

### 6.3 GitHub Actions 자동 롤백 (P40)

| 트리거 | 동작 |
|--------|------|
| `Deploy` 실패 (CLI 배포 후 health 실패 등) | `rollback.yml` reusable 호출 |
| Actions → **Rollback** → Run workflow | 수동 롤백 (`reason`, 선택적 `deployment_url`) |

필요 시크릿: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (+ `FOLIO_PRODUCTION_URL`)

```bash
# UI: Actions → Rollback → Run workflow
# 또는 실패 시 deploy.yml 이 자동 호출
```

### 6.4 Git revert (코드 원복 + 재배포)

잘못된 커밋이 `main`에 있고, 다음 배포까지 코드를 되돌리려 할 때:

```bash
git fetch origin
git checkout main
git pull origin main

# 단일 커밋 되돌리기 (히스토리 보존)
git revert <bad-sha> --no-edit

# 연속 여러 커밋이면
git revert --no-edit <oldest-bad-sha>^..<newest-bad-sha>

git push origin main
# → Vercel Production 자동 배포
```

확인:

```bash
curl -sS https://<host>/api/health
git log -3 --oneline
```

**주의**

- `git push --force` 로 main 을 되돌리지 않는다 (팀·Vercel 이력 파괴).
- DB/스키마를 깨는 마이그레이션이 포함된 경우 revert만으로 부족할 수 있다 → [INCIDENT.md](./INCIDENT.md) · [BACKUP.md](./BACKUP.md).

### 6.5 Docker / GHCR 롤백

```bash
docker compose down

# GHCR 이전 태그
docker pull ghcr.io/<owner>/folio:sha-<previous>
# 또는 로컬 태그
docker tag folio:local folio:broken
docker images | head

# compose image 를 이전 태그로 맞춘 뒤
docker compose up -d
curl -sS http://localhost:3000/api/health
docker compose ps
```

### 6.6 롤백 후 체크리스트

- [ ] `/api/health` · `/api/runtime` OK
- [ ] 로그인 · 일지/문서 저장 스모크
- [ ] 잘못된 배포 원인 이슈 등록
- [ ] 필요 시 [INCIDENT.md](./INCIDENT.md) 타임라인 기록

---

## 7. 배포 후 기록

- [ ] Production URL · Deployment ID
- [ ] health / runtime JSON 보관
- [ ] GHCR digest / 태그 (자가호스팅 시)
- [ ] 이슈 있으면 INCIDENT 런북으로 이관

---

## 8. Actions 워크플로우 요약 (P40)

| 파일 | 역할 |
|------|------|
| `ci.yml` | lint · typecheck · qa:smoke · test · build |
| `deploy.yml` | main 게이트 → Vercel Production → health → 실패 시 rollback |
| `docker.yml` | multi-stage 빌드 · GHCR 푸시 (GHA cache) |
| `rollback.yml` | `vercel rollback` (+ health) |
| `monitor.yml` | 30분마다 Production health/runtime |
| `folio-sync.yml` | Folio webhook (P39) |

---

관련: [INCIDENT.md](./INCIDENT.md) · [BACKUP.md](./BACKUP.md) · [UPGRADE.md](./UPGRADE.md) · [docs/DEPLOY.md](../DEPLOY.md)
