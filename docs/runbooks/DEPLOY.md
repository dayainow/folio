# 배포 런북 (Deploy)

Vercel · Docker 배포, 헬스체크, **롤백**. (P22 · **P27** · **1.0.0**)

상세 배경: [docs/DEPLOY.md](../DEPLOY.md) · 환경변수: [.env.production.example](../../.env.production.example) · [docs/env.example](../env.example)

---

## 1. 브랜치 전략

| 브랜치 | 환경 | 동작 |
|--------|------|------|
| `feature/*` → PR | **Preview** | Vercel Preview URL |
| `main` | **Production** | 자동 Production 배포 |

```
feature/* ──PR──▶ Preview
                 │ merge
                 ▼
               main ──▶ Production
```

`vercel.json` → `git.deploymentEnabled.main: true`

---

## 2. 배포 전 체크리스트

- [ ] `npm run lint && npm run typecheck && npm run qa:smoke`
- [ ] `.env.production.example` 기준으로 Production / Preview env 확인
- [ ] Supabase Auth Redirect URL (Production · Preview · 커스텀 도메인)
- [ ] `VERSION.md` · README 작업 관리 갱신
- [ ] (권장) `npm run runbook:backup`

---

## 3. 환경변수 설정

| 구분 | Vercel | Docker |
|------|--------|--------|
| `NEXT_PUBLIC_*` | Production + Preview | build-arg + runtime |
| `JIRA_*` / 웹훅 / `GITHUB_*` | Production (필요 시 Preview) | `.env.local` / `env_file` |
| `FOLIO_VERSION` | 선택 (`1.0.0`) | Dockerfile ARG / compose |
| `BEACON_PROJECT_ROOT` | 보통 미사용 | 자가호스팅 시 설정 |

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

1. PR 머지 → `main` push
2. Vercel Production 배포
3. (선택) GitHub Actions `deploy.yml`

**CLI**

```bash
npx vercel          # Preview
npx vercel --prod   # Production
```

단계별 UI 가이드: [docs/DEPLOY.md](../DEPLOY.md) § Vercel 배포

### 4.3 Docker

```bash
cp docs/env.example .env.local
docker compose up --build -d
docker compose ps          # State healthy
curl -sS http://localhost:3000/api/health
```

---

## 5. 헬스체크 확인

```bash
curl -sS https://<host>/api/health
# {"status":"ok","version":"1.0.0",…}

curl -sS https://<host>/health          # rewrite
curl -sS https://<host>/api/runtime
```

| 확인 | 기대 |
|------|------|
| `/api/health` | `status: "ok"` |
| `/api/runtime` | 버전 · env flags |
| 앱 스모크 | 로그인 · 일지 저장 |
| Docker | `health: healthy` |

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

### 6.3 Git revert (코드 원복 + 재배포)

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

### 6.4 Docker 롤백

```bash
docker compose down

# 이전 태그/이미지로 지정해 기동 (예: folio:1.0.0-prev)
docker tag folio:local folio:broken
docker pull <registry>/folio:<previous-tag>   # 레지스트리 사용 시
# 또는 로컬에 남은 이미지 ID
docker images | head

# compose image 태그를 이전으로 맞춘 뒤
docker compose up -d
curl -sS http://localhost:3000/api/health
docker compose ps
```

### 6.5 롤백 후 체크리스트

- [ ] `/api/health` · `/api/runtime` OK
- [ ] 로그인 · 일지/문서 저장 스모크
- [ ] 잘못된 배포 원인 이슈 등록
- [ ] 필요 시 [INCIDENT.md](./INCIDENT.md) 타임라인 기록

---

## 7. 배포 후 기록

- [ ] Production URL · Deployment ID
- [ ] health / runtime JSON 보관
- [ ] 이슈 있으면 INCIDENT 런북으로 이관

---

관련: [INCIDENT.md](./INCIDENT.md) · [BACKUP.md](./BACKUP.md) · [UPGRADE.md](./UPGRADE.md) · [docs/DEPLOY.md](../DEPLOY.md)
