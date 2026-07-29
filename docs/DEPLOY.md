# Folio 배포 가이드

로컬 · Vercel · Docker · CI 배포 절차. (P13에서 도입, P17에서 문서 인덱스에 포함)

## 환경변수

템플릿: [docs/env.example](./env.example)

| 구분 | 변수 | 노출 | 비고 |
|------|------|------|------|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트 | 빌드·런타임 모두 필요 |
| Jira | `JIRA_*` | 서버만 | `/api/jira/*` |
| Slack | `SLACK_WEBHOOK_URL` | 서버만 | 없으면 알림 스킵 |
| Discord | `DISCORD_WEBHOOK_URL` | 서버만 | 없으면 알림 스킵 |
| GitHub | `GITHUB_TOKEN`, `GITHUB_REPO` | 서버만 | 없으면 UI 숨김 |

**규칙**

- 시크릿은 절대 `NEXT_PUBLIC_` 로 올리지 않는다.
- Git에 `.env.local` 을 커밋하지 않는다 (`.gitignore`).
- Vercel / Docker / CI 각각에 필요한 값만 주입한다.

---

## 브랜치 전략 (Preview / Production)

| 브랜치 | Vercel | 용도 |
|--------|--------|------|
| `main` | **Production** | 공식 배포, 시크릿 Production 환경 |
| PR / 기타 브랜치 | **Preview** | 기능 검증, Preview 환경 변수 |

권장 흐름

1. feature 브랜치에서 작업 → PR → Preview URL로 확인
2. 리뷰 후 `main` 머지 → Production 자동 배포
3. Preview와 Production의 Supabase Redirect URL을 각각 등록

```
feature/* ──PR──▶ Preview (*.vercel.app)
                      │
                   merge
                      ▼
                   main ──▶ Production
```

---

## 로컬

```bash
cp docs/env.example .env.local
# .env.local 값 채우기
npm install
npm run dev
# http://localhost:3000
```

품질 검사

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

---

## Vercel

### 최초 설정

1. [vercel.com](https://vercel.com) → Import Git Repository (`dayainow/folio`)
2. Framework Preset: **Next.js** (`vercel.json` 참고)
3. Environment Variables에 `docs/env.example` 목록 등록
   - `NEXT_PUBLIC_*`: Production + Preview
   - `JIRA_*` / `SLACK_*` / `DISCORD_*` / `GITHUB_*`: Production (필요 시 Preview)
4. Deploy
5. Supabase Dashboard → Auth → URL Configuration
   - Site URL: Production 도메인
   - Redirect: `https://<project>.vercel.app/**`, Preview 패턴

### CLI

```bash
npx vercel          # Preview
npx vercel --prod   # Production (main 권장)
```

### 참고

- Region: `vercel.json` 의 `icn1` (서울). 변경 시 `regions` 수정.
- 서버 라우트(`/api/*`)는 Vercel Serverless / Edge 정책에 따름. 현재 Node runtime.

---

## Docker

이미지는 Next.js `output: "standalone"` 멀티스테이지 빌드 (`Dockerfile`).

### 직접 빌드·실행

```bash
docker build -t folio:local \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  .

docker run --rm -p 3000:3000 --env-file .env.local folio:local
```

### Compose (권장)

```bash
cp docs/env.example .env.local   # 값 채움
docker compose up --build
# http://localhost:3000
```

중지: `docker compose down`

`.dockerignore` 로 `node_modules` / `.next` / `.env*` 등을 제외해 컨텍스트를 줄인다.

---

## CI/CD (GitHub Actions)

워크플로: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

`main` push 및 PR에서 실행:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test`
5. `npm run build` (placeholder 공개 env)

배포 자체는 Vercel Git 연동 또는 Docker 레지스트리 푸시로 분리한다. CI는 품질 게이트 역할.

---

## 체크리스트

- [ ] `.env.local` / Vercel env 채움
- [ ] Supabase 스키마 (기본 + team) 적용
- [ ] Auth Redirect URL 등록
- [ ] Preview에서 로그인·Jira/알림 스모크 테스트
- [ ] `main` 머지 후 Production 확인

---

관련: [GETTING-STARTED.md](./GETTING-STARTED.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [BEACON.md](./BEACON.md)
