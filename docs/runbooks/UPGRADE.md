# 업그레이드 런북 (Upgrade)

버전 업그레이드 · 마이그레이션 · 다운타임 최소화. (P22 · 0.7.0)

---

## 1. 버전 정책

| 구분 | 예 | 의미 |
|------|----|------|
| 정식 | `0.7.0` | Phase 완료 릴리즈 |
| WIP | `0.7.0-wip` | Phase 진행 중 |
| Patch | `0.7.1` | 버그픽스 · 문서 |

갱신 파일: `package.json` · `VERSION.md` · `README.md` · (선택) `FOLIO_VERSION` env · Dockerfile

---

## 2. 마이그레이션 체크리스트

업그레이드 전:

- [ ] `VERSION.md` 변경 이력 읽기 (브레킹 체인지)
- [ ] `docs/env.example` 신규 키 확인 → Vercel/Docker에 반영
- [ ] Supabase 스키마 변경 여부 (`docs/supabase-schema*.sql`)
- [ ] Beacon / PROCESS 규약 변경 여부
- [ ] `npm run runbook:backup`
- [ ] 스테이징 또는 Preview에서 스모크

스키마 적용 (해당 시):

1. Supabase SQL Editor에 신규/변경 스크립트 적용
2. RLS · 인덱스 확인
3. Auth Redirect URL 유지

앱 데이터:

- localStorage 키 이름 변경 시 마이그레이션 코드(`src/lib/migrate.ts` 등) 확인
- 저장 모드(local/cloud/beacon) 동작 회귀 테스트

---

## 3. 호환성 검증

```bash
node -v          # 권장: 22.x (CI/Docker와 동일)
npm ci
npm run lint
npm run typecheck
npm run qa:smoke
npm run build
```

런타임 확인:

```bash
npm run start
curl -sS localhost:3000/api/health
curl -sS localhost:3000/api/runtime
```

`/api/runtime` 에서 확인할 것:

- `version` / `folioVersion`
- `nodeVersion` · `nextVersion`
- env 플래그 (`supabase`, `jira`, `slack` …) — **값 자체가 아니라 설정 여부만**

브라우저:

- [ ] 일지 저장 · 날짜 이동
- [ ] 문서 편집 · 저장
- [ ] 보드 이동
- [ ] 로그인 · 클라우드 모드 (설정 시)
- [ ] 프로세스 탭 (Beacon 있을 때)

---

## 4. 다운타임 최소화

| 전략 | 설명 |
|------|------|
| Preview 먼저 | PR Preview에서 검증 후 `main` 머지 |
| 롤링 / 즉시 교체 | Vercel은 원자적 배포 · 실패 시 이전 배포 유지되는 경우가 많음 |
| 스키마 선행 | 하위 호환 SQL을 Production에 먼저 적용 후 앱 배포 |
| 기능 플래그성 | 신규 연동은 env 미설정 시 스킵되도록 유지 |
| 백업 | 업그레이드 직전 `npm run runbook:backup` |

권장 순서:

1. Preview 배포 · 스모크
2. (필요) DB 마이그레이션 (하위 호환)
3. `main` 머지 → Production
4. health / runtime / 핵심 플로우 확인
5. 문제 시 [DEPLOY.md](./DEPLOY.md) 롤백 · [INCIDENT.md](./INCIDENT.md)

---

## 5. 업그레이드 실행 요약

```bash
# 1) 백업
npm run runbook:backup

# 2) 의존성 · 품질
npm ci
npm run lint && npm run typecheck && npm run qa:smoke

# 3) 버전 문서 갱신 (VERSION.md / README / package.json)

# 4) 배포
npm run runbook:deploy

# 5) 검증
curl -sS https://<host>/api/health
curl -sS https://<host>/api/runtime
```

---

## 6. 0.7.0 릴리즈 노트 (요약)

- Phase 6 완료: 모니터링(P20) · Beacon 고도화(P21) · 운영 런북(P22)
- `/api/health` · `/api/runtime`
- 헤더 상태 뱃지 · 저장 실패 알림
- Beacon 변경 감지 · 스냅샷 · Diff
- `docs/runbooks/*` 운영 절차

이전 정식: **0.6.0** (Phase 5)

---

관련: [INCIDENT.md](./INCIDENT.md) · [BACKUP.md](./BACKUP.md) · [DEPLOY.md](./DEPLOY.md)
