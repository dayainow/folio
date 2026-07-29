# 장애 대응 런북 (Incident)

Folio 서비스 장애 시 대응 절차. (P22 · 0.7.0)

---

## 1. 장애 정의

| 심각도 | 정의 | 예시 |
|--------|------|------|
| **P0 Critical** | 서비스 전면 불가 | Production 5xx 지속, 헬스체크 실패, 로그인 전면 불가 |
| **P1 High** | 핵심 기능 저하 | Journal/Docs/Board 저장 실패, Supabase 동기화 중단 |
| **P2 Medium** | 부가 기능 장애 | Jira/GitHub/Slack/Discord 연동 실패, Beacon 미연동 |
| **P3 Low** | 경미·단발성 | Preview만 실패, 단일 사용자 UI 이슈 |

**장애로 간주하는 신호**

- `GET /api/health` 가 200이 아니거나 `status !== "ok"`
- Vercel / Docker 헬스체크 연속 실패
- 헤더 상태 뱃지: **클라우드 연결 끊김** (주황) 지속
- Slack/Discord로 저장 실패 웹훅이 반복 수신

---

## 2. 영향 범위

| 영역 | 영향 | 완화 |
|------|------|------|
| 로컬 저장 | 브라우저 localStorage | 대부분 기능 오프라인 가능 |
| 클라우드 (Supabase) | 동기화·팀·Auth | 로컬 폴백 · 미로그인 시 클라우드 모드 비활성 |
| Beacon | 프로세스 탭 · beacon 저장 모드 | 로컬 폴백 · available=false 시 UI 안내 |
| 외부 연동 | Jira / Slack / Discord / GitHub | 미설정 시 스킵 또는 UI 숨김 |
| Vercel 서버리스 | `.beacon` FS 없음 | Beacon 기능 제한적 |

---

## 3. 대응 순서

### 3.1 즉시 확인 (5분 이내)

1. **헬스체크**
   ```bash
   curl -sS https://<production-host>/api/health
   curl -sS https://<production-host>/api/runtime
   ```
2. **Vercel Dashboard** → Deployments · Runtime Logs · 최근 배포 상태
3. **헤더 상태 뱃지** (앱) → 상세 패널에서 로컬 / Supabase / Beacon 확인
4. **외부 상태** (해당 시): Supabase Status, Vercel Status

### 3.2 로그 확인

| 환경 | 방법 |
|------|------|
| Vercel | Project → Logs / Deployments → 실패한 빌드·함수 로그 |
| Docker | `docker compose logs -f folio` · `docker inspect folio` |
| 로컬 | 터미널 `next dev` / `next start` 출력 |
| GitHub Actions | Actions → CI / Deploy 워크플로 로그 |

확인 포인트: 5xx, env 누락, timeout, Supabase auth 오류, `/api/*` 실패

### 3.3 복구 (Rollback)

**Vercel**

1. Dashboard → Deployments → 직전 정상 Production 배포 선택 → **Promote to Production**
2. 또는 CLI:
   ```bash
   npx vercel rollback
   # 또는 특정 배포 URL
   npx vercel promote <deployment-url> --prod
   ```

**Docker**

```bash
# 이전 이미지 태그로 재기동 (예시)
docker compose down
docker pull <registry>/folio:<previous-tag>   # 사용 중인 레지스트리 기준
# 또는 로컬 이전 빌드 태그
FOLIO_IMAGE=folio:<previous> docker compose up -d
```

**Git 기준 재배포**

```bash
git revert <bad-commit>   # 또는 이전 태그 체크아웃 후 재배포
git push origin main
```

### 3.4 완화 (Rollback 전 임시)

- 저장 모드를 **로컬**로 안내 (클라우드/Beacon 장애 시)
- 문제 환경변수 Preview만 수정 후 재배포 테스트
- 외부 웹훅 장애는 기능 스킵으로 서비스 유지 가능

---

## 4. 통지 방법

| 대상 | 방법 |
|------|------|
| 운영 채널 | Slack / Discord Incoming Webhook (`/api/notify`) |
| 저장 실패 | P20: 원격 저장 폴백 시 자동 웹훅 (60초 쿨다운) |
| 이해관계자 | 장애 심각도·영향·ETA를 한 줄 요약으로 공유 |

통지 템플릿 예:

```
[P1] Folio Production 장애
영향: 클라우드 동기화 불가 (로컬 저장은 가능)
조치: Supabase 상태 확인 중 / 필요 시 Vercel rollback
ETA: 30분
```

---

## 5. 사후 분석 (Postmortem)

장애 해소 후 24–48시간 내 기록:

1. **타임라인**: 감지 → 대응 → 복구 시각
2. **근본 원인**: 배포 / env / 외부 의존성 / 코드 버그
3. **영향**: 사용자 수 · 기능 · 데이터 손실 여부
4. **조치**: 단기 수정 · 재발 방지
5. **후속 태스크**: 이슈/PR로 추적

체크리스트

- [ ] 헬스·런타임 로그 보관
- [ ] 재현 절차 문서화
- [ ] 모니터링/알림 임계값 조정 여부 검토
- [ ] 런북(본 문서) 보완

---

관련: [BACKUP.md](./BACKUP.md) · [DEPLOY.md](./DEPLOY.md) · [UPGRADE.md](./UPGRADE.md)
