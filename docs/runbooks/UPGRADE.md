# 업그레이드 런북 (Upgrade)

버전 업그레이드 · 마이그레이션 · 다운타임 최소화. (P22 · **v2.6 갱신**)

---

## 0. v2.8 (2.7 → 2.8)

| 구분 | 예 | 의미 |
|------|----|------|
| 정식 | `2.8.0` | Phase 26 완료 릴리즈 |
| WIP | `3.0.0-wip` | Phase 28 P56 실무 편의성 |
| Patch | `2.8.1` | 버그픽스 · 문서 |

체크리스트:

- [ ] `npm run runbook:backup`
- [ ] 사이드바 **마이그레이션** 업/롤백 · SQLite JSON 스모크 ([docs/MIGRATION-TOOLS.md](../MIGRATION-TOOLS.md))
- [ ] `npm ci` · `npm run lint && npm run typecheck && npm run test && npm run qa:smoke`
- [ ] Preview/스테이징 스모크 후 Production

---

## 0.1. v2.7 (2.6 → 2.7)

| 구분 | 예 | 의미 |
|------|----|------|
| 정식 | `2.7.0` | Phase 25 완료 릴리즈 |
| WIP | `2.7.0-wip` | Phase 진행 중 |
| Patch | `2.7.1` | 버그픽스 · 문서 |

체크리스트:

- [ ] `npm run runbook:backup`
- [ ] 헤더 언어 토글 ko/en/ja · `/guide` locale 스모크 ([docs/I18N.md](../I18N.md))
- [ ] `npm ci` · `npm run lint && npm run typecheck && npm run test && npm run qa:smoke`
- [ ] Preview/스테이징 스모크 후 Production

---

## 0.2. v2.6 (2.5 → 2.6)

| 구분 | 예 | 의미 |
|------|----|------|
| 정식 | `2.6.0` | Phase 24 완료 릴리즈 |
| WIP | `2.6.0-wip` | Phase 진행 중 |
| Patch | `2.6.1` | 버그픽스 · 문서 |

체크리스트:

- [ ] `npm run runbook:backup`
- [ ] 헤더 **고급검색** 프리셋 · 쿼리 · CSV/JSON 스모크 ([docs/SEARCH.md](../SEARCH.md))
- [ ] `npm ci` · `npm run lint && npm run typecheck && npm run test && npm run qa:smoke`
- [ ] Preview/스테이징 스모크 후 Production

---

## 0.3. v2.5 (2.4 → 2.5)

| 구분 | 예 | 의미 |
|------|----|------|
| 정식 | `2.5.0` | Phase 23 완료 릴리즈 |
| WIP | `2.5.0-wip` | Phase 진행 중 |
| Patch | `2.5.1` | 버그픽스 · 문서 |

체크리스트:

- [ ] `npm run runbook:backup`
- [ ] 사이드바 **플러그인** 마켓 설치 · 위젯 · 커스텀 필드 스모크 ([docs/plugins/README.md](../plugins/README.md))
- [ ] `npm ci` · `npm run lint && npm run typecheck && npm run test && npm run qa:smoke`
- [ ] Preview/스테이징 스모크 후 Production

---

## 0.4. v2.4 (2.3 → 2.4)

| 구분 | 예 | 의미 |
|------|----|------|
| 정식 | `2.4.0` | Phase 22 완료 릴리즈 |
| WIP | `2.4.0-wip` | Phase 진행 중 |
| Patch | `2.4.1` | 버그픽스 · 문서 |

체크리스트:

- [ ] `npm run runbook:backup`
- [ ] 사이드바 **성능** 대시보드 · Web Vitals 수집 확인 ([docs/PERFORMANCE.md](../PERFORMANCE.md))
- [ ] `npm ci` · `npm run lint && npm run typecheck && npm run test && npm run qa:smoke`
- [ ] `npm run build && BUNDLE_BUDGET_FAIL=1 npm run bundle:size`
- [ ] (선택) `npm run lhci`
- [ ] Preview/스테이징 스모크 후 Production

---

## 0.5. v2.3 (2.2 → 2.3)

| 구분 | 예 | 의미 |
|------|----|------|
| 정식 | `2.3.0` | Phase 21 완료 릴리즈 |
| WIP | `2.3.0-wip` | Phase 진행 중 |
| Patch | `2.3.1` | 버그픽스 · 문서 |

체크리스트:

- [ ] `npm run runbook:backup`
- [ ] Supabase MFA(TOTP) · OAuth providers (`NEXT_PUBLIC_AUTH_OAUTH_PROVIDERS`) 확인 ([docs/SECURITY.md](../SECURITY.md))
- [ ] `npm ci` · `npm run lint && npm run typecheck && npm run test && npm run qa:smoke`
- [ ] 사이드바 **보안** (2FA · 세션 · 감사 · GDPR) 스모크
- [ ] mutating API CSRF (`x-folio-csrf`) · `npm run audit`
- [ ] Preview/스테이징 스모크 후 Production

---

## 0.6. v2.2 (2.1 → 2.2)

| 구분 | 예 | 의미 |
|------|----|------|
| 정식 | `2.2.0` | Phase 20 완료 릴리즈 |
| WIP | `2.2.0-wip` | Phase 진행 중 |
| Patch | `2.2.1` | 버그픽스 · 문서 |

체크리스트:

- [ ] `npm run runbook:backup`
- [ ] `NEXT_PUBLIC_COLLAB_WS_URL` · `npm run collab:server` 확인 ([docs/COLLAB-SERVER.md](../COLLAB-SERVER.md))
- [ ] `npm ci` · `npm run lint && npm run typecheck && npm run test && npm run qa:smoke`
- [ ] 협업 모드 local/server/hybrid · 채팅/보드 스모크
- [ ] Preview/스테이징 스모크 후 Production

---

## 0.7. v2.1 (2.0 → 2.1)

| 구분 | 예 | 의미 |
|------|----|------|
| 정식 | `2.1.0` | Phase 19 완료 릴리즈 |
| WIP | `2.1.0-wip` | Phase 진행 중 |
| Patch | `2.1.1` | 버그픽스 · 문서 |

체크리스트:

- [ ] `npm run runbook:backup`
- [ ] `AUDIT_LOG_RETENTION_DAYS` · `STORAGE_ALERT_THRESHOLD` 확인 ([docs/env.example](../env.example))
- [ ] `npm ci` · `npm run lint && npm run typecheck && npm run test && npm run qa:smoke`
- [ ] 사이드바 **저장 관측** 대시보드 동작 확인
- [ ] Preview/스테이징 스모크 후 Production

---

## 0.8. v2.0 (1.x → 2.0)

상세: **[docs/MIGRATION.md](../MIGRATION.md)**

| 구분 | 예 | 의미 |
|------|----|------|
| 정식 | `2.0.0` | Phase 18 완료 릴리즈 |
| WIP | `2.0.0-wip` | Phase 진행 중 |
| Patch | `2.0.1` | 버그픽스 · 문서 |

체크리스트:

- [ ] `npm run runbook:backup`
- [ ] `docs/env.example` 대조 · CSP 영향 확인
- [ ] `npm run lint && npm run typecheck && npm run test && npm run qa:smoke`
- [ ] Preview/스테이징 스모크 후 Production

---

## 1. 버전 정책

| 구분 | 예 | 의미 |
|------|----|------|
| 정식 | `0.7.0` / `2.0.0` / `2.1.0` / `2.2.0` / `2.3.0` / `2.4.0` / `2.5.0` / `2.6.0` / `2.7.0` | Phase 완료 릴리즈 |
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
