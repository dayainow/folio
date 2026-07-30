# 배포 런북 (Deploy)

Vercel · Docker 배포, 헬스체크, 롤백. (P22 · 0.7.0)

상세 배경: [docs/DEPLOY.md](../DEPLOY.md) · 환경변수: [docs/env.example](../env.example)

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
- [ ] `docs/env.example` 기준으로 Production / Preview env 설정 확인
- [ ] Supabase Auth Redirect URL (Production · Preview) 등록
- [ ] `VERSION.md` · README 작업 관리 갱신
- [ ] (권장) `npm run runbook:backup`

---

## 3. 환경변수 설정

| 구분 | Vercel | Docker |
|------|--------|--------|
| `NEXT_PUBLIC_*` | Production + Preview | build-arg + runtime |
| `JIRA_*` / 웹훅 / `GITHUB_*` | Production (필요 시 Preview) | `.env.local` / `env_file` |
| `FOLIO_VERSION` | 선택 | Dockerfile / compose |
| `BEACON_PROJECT_ROOT` | 보통 미사용 | 자가호스팅 시 설정 |

시크릿은 `NEXT_PUBLIC_` 로 올리지 않는다. `.env.local` 은 커밋하지 않는다.

---

## 4. 배포 절차

### 4.1 스크립트 (진입점)

```bash
npm run runbook:deploy
# 기본: Vercel production (npx vercel --prod)
# FOLIO_DEPLOY_TARGET=docker 이면 docker compose up --build -d
```

### 4.2 Vercel (권장)

**Git 연동 (기본)**

1. PR 머지 → `main` push
2. Vercel이 Production 배포
3. (선택) GitHub Actions `deploy.yml` — Secrets 있을 때 CLI 배포

**CLI**

```bash
npx vercel          # Preview
npx vercel --prod   # Production
# 또는
npm run runbook:deploy
```

### 4.3 Docker

```bash
cp docs/env.example .env.local   # 값 채움
docker compose up --build -d
# 또는
FOLIO_DEPLOY_TARGET=docker npm run runbook:deploy
```

---

## 5. 헬스체크 확인

배포 직후:

```bash
curl -sS https://<host>/api/health
# {"status":"ok","version":"0.9.0","uptime":…,"timestamp":"…"}

curl -sS https://<host>/api/runtime
# nodeVersion, nextVersion, envFlags, uptime …
```

| 확인 | 기대 |
|------|------|
| `/api/health` | `status: "ok"` |
| `/api/runtime` | 버전 일치 · 필수 env `configured` |
| 앱 스모크 | 로그인 · 일지 저장 · (해당 시) Beacon |
| CI | lint · typecheck · qa:smoke · build 통과 |

Docker는 이미지 `HEALTHCHECK` 가 `/api/health` 를 사용한다.

---

## 6. 롤백

### Vercel

```bash
npx vercel rollback
# 또는 Dashboard → Deployments → 이전 배포 Promote
```

### Docker

```bash
docker compose down
# 이전 이미지/태그로 재기동 후
docker compose up -d
curl -sS http://localhost:3000/api/health
```

### Git

```bash
git revert <bad-sha>
git push origin main
# → Production 재배포 + 헬스체크
```

장애 시 상세: [INCIDENT.md](./INCIDENT.md)

---

## 7. 배포 후 기록

- [ ] Production URL · 배포 ID 기록
- [ ] health / runtime 응답 스크린샷 또는 JSON 보관
- [ ] 이슈 있으면 INCIDENT 런북으로 이관

---

관련: [INCIDENT.md](./INCIDENT.md) · [BACKUP.md](./BACKUP.md) · [UPGRADE.md](./UPGRADE.md)
