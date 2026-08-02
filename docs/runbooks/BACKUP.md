# 백업 · 복구 런북 (Backup / Restore)

Supabase · Beacon · localStorage 데이터 백업과 복구. (P22 · **v2.0 갱신**)

### RPO / RTO (목표)

| 지표 | 목표 |
|------|------|
| RPO | 수동 백업 직전 / Supabase PITR 정책에 따름 |
| RTO | Vercel Promote 또는 Docker 재기동 ≤ 15분 |

오프사이트: `backups/` 디렉터리를 별도 스토리지에 복사 권장. 분기 1회 복구 drill.

---

## 1. 백업 대상

| 대상 | 내용 | 위치 |
|------|------|------|
| **localStorage** | 일지·문서·보드·설정 | 브라우저 (키: `workspace_*`, `folio_*`) |
| **Supabase** | journals / docs / boards / teams | 클라우드 DB |
| **Beacon** | project.json · beacon.db · Folio 캐시 · Folio 스냅샷 | `.beacon/` |

---

## 2. 백업 주기

| 종류 | 주기 | 방법 |
|------|------|------|
| **자동 (Beacon Folio 스냅샷)** | 파일 변경 시 + 약 5분 | 프로세스 탭 / `createFolioBeaconSnapshot` |
| **수동 (스크립트)** | 배포 전 · 대규모 변경 전 | `npm run runbook:backup` |
| **Supabase** | 프로젝트 정책에 따름 (권장: 일 1회+) | Dashboard · `pg_dump` · PITR(플랜에 따라) |
| **localStorage** | 사용자 요청 / 기기 이전 전 | 앱 내보내기 또는 DevTools |

---

## 3. 자동 / 수동 백업

### 3.1 스크립트 (권장 진입점)

```bash
# .env.local 준비 후
npm run runbook:backup
# → backups/folio-backup-<timestamp>/ 생성
```

백업에 포함되는 것:

- `.beacon/` 전체 복사 (있을 때: project.json, beacon.db, cache, snapshots)
- `docs/env.example` 복사 (시크릿 값 제외한 키 목록)
- `manifest.json` (시각 · 버전 · 포함 항목)

**포함하지 않는 것:** `.env.local` 실값, `node_modules`, `.next`

### 3.2 Supabase 수동 백업

1. Supabase Dashboard → Database → Backups (플랜별)
2. 또는 로컬/CI에서 (연결 문자열은 시크릿으로만):
   ```bash
   pg_dump "$DATABASE_URL" -Fc -f "backups/supabase-$(date +%Y%m%d).dump"
   ```
3. Storage 버킷을 쓰는 경우 Storage도 별도 백업

### 3.3 localStorage 백업

브라우저 DevTools → Application → Local Storage → 관련 키 export, 또는 앱 내 내보내기 기능(있는 경우).

주요 키 예: `workspace_journals`, `workspace_docs`, `workspace_boards`(또는 boards 관련 키), `folio_storage_mode` 등.

### 3.4 Beacon 수동 복사

```bash
cp -a .beacon "backups/beacon-$(date +%Y%m%d-%H%M%S)"
# 또는
npm run runbook:backup
```

---

## 4. 복구 절차

### 4.1 스크립트

```bash
npm run runbook:restore -- backups/folio-backup-<timestamp>
```

- `.beacon/` 이 백업에 있으면 복원 (기존 `.beacon`은 `.beacon.bak-<timestamp>` 로 이동)
- Supabase/localStorage는 안내 메시지에 따라 수동 복구

### 4.2 Supabase 복구

1. Dashboard Backups → 시점 선택 → Restore (플랜·권한에 따름)
2. 또는 `pg_restore` 로 dump 복원 (스테이징에서 먼저 검증)

### 4.3 localStorage 복구

1. 백업 JSON을 키별로 `localStorage.setItem` 복원
2. 페이지 새로고침 후 Journal/Docs/Board 내용 확인

### 4.4 Beacon 스냅샷에서 상태 확인

- Folio 스냅샷은 **관측용 백업**이다. CLI 상태를 덮어쓰지 않는다.
- 비교: 프로세스 탭 Diff UI 또는 스냅샷 JSON을 열어 timeline/project 확인
- CLI 원본 복구가 필요하면 Beacon CLI/백업 정책을 따른다

---

## 5. 복구 테스트 방법

분기마다 또는 메이저 배포 전:

1. `npm run runbook:backup` 실행
2. 스테이징/로컬에서 `npm run runbook:restore -- <backup-dir>`
3. `npm run dev` 후 프로세스 탭 · 일지/문서/보드 스모크
4. `curl -s localhost:3000/api/health` · `/api/runtime` 확인

---

## 6. 데이터 무결성 검증

| 검사 | 방법 |
|------|------|
| Health | `GET /api/health` → `status: "ok"` |
| Runtime | `GET /api/runtime` → 버전·env 설정 여부 |
| Beacon | 프로세스 탭 Gate/Timeline 표시 · `GET /api/beacon/available` |
| 스냅샷 | 목록 로드 · 두 스냅샷 Diff에 오류 없음 |
| 클라우드 | 로그인 후 저장 → 다른 세션/기기에서 동일 데이터 |
| 로컬 | 저장 후 새로고침 · 날짜/문서 전환 후 내용 유지 |

체크리스트

- [ ] 백업 디렉터리에 `manifest.json` 존재
- [ ] 시크릿(`.env.local`)이 백업에 포함되지 않음
- [ ] 복구 후 health · 주요 탭 스모크 통과

---

관련: [INCIDENT.md](./INCIDENT.md) · [DEPLOY.md](./DEPLOY.md) · [UPGRADE.md](./UPGRADE.md)
