# Folio ↔ Beacon 연동 (BEACON)

> Beacon은 선택 확장 기능이다. Folio는 Beacon CLI나 `.beacon/` 폴더 없이도 로컬
> 프로세스 단계와 Gate를 생성·편집·저장한다. Beacon을 연결하면 프로젝트 스캔,
> 파일 변경 감지, 산출물 연동, 스냅샷 Diff가 추가된다.
> 저장 방식 메뉴에서도 로컬·클라우드와 분리된 **고급 확장**으로 표시된다.

Folio **프로세스** 탭과 저장 모드 `Beacon`이 Beacon Project OS와 어떻게 맞물리는지 정리한다.  
규약 원문: [PROCESS.md](../PROCESS.md)

## 원칙

1. **Beacon 프로젝트 루트가 원본** — 프로세스 상태·산출물의 출처
2. **CLI 원본 필드 보존** — `version` / `initializedAt` / `beacon.db` 는 Folio가 덮어쓰지 않음
3. **Folio 오버레이 (P23)** — `project.json.folio` + append-only `edits` · artifact 파일 · folio-timeline.jsonl
4. **Folio 캐시** — `.beacon/cache/folio-*.json` (Journal/Docs/Board 저장 모드)
5. **두 리포 분리** — Folio UI와 beacon-project-os CLI는 독립 저장소

## 경로

| 항목 | 기본값 | 환경변수 |
|------|--------|----------|
| 프로젝트 루트 | `process.cwd()` | `BEACON_PROJECT_ROOT` |
| Beacon 디렉터리 | `<root>/.beacon` | — |
| DB | `.beacon/beacon.db` | — |
| Folio 오버레이 | `.beacon/project.json` → `folio` | — |
| Folio Timeline | `.beacon/folio-timeline.jsonl` | — |
| Folio artifacts | `.beacon/artifacts/folio/**` | — |
| Folio 캐시 | `.beacon/cache/folio-*.json` | — |

`.beacon/` 은 gitignore 대상일 수 있다. 로컬에서만 생성된다.

## 초기화

프로젝트 루트에서 (beacon-project-os CLI):

```bash
beacon init --root /path/to/project
beacon open --root /path/to/project
```

Folio `.env.local`:

```bash
BEACON_PROJECT_ROOT=/path/to/project
```

미설정 시 Folio가 실행 중인 워킹 디렉터리를 루트로 사용한다.

## Folio에서의 사용

### 프로세스 탭

- Gate (P0–P4) · Timeline · 산출물 체크리스트
- **편집 (P23)**: 프로젝트 이름 · Gate 상태 · 산출물 체크 → `PUT /api/beacon/project`
- 충돌: mtime 불일치 시 병합/재적용
- Timeline 동의 토글 (기본 off) → `POST /api/beacon/timeline`
- Docs 「Beacon으로 export」 → `POST /api/beacon/artifacts`
- **자동 감지 (P24)**: project.json 변경 → live Diff · 토스트 · 헤더 뱃지
- **Gate 자동화 (P24)**: 체크리스트 100% → Gate PASS · 불일치 경고 · 산출물 완료율
- **Timeline 분석 (P24)**: 주/월 건수 · 히트맵
- API: `GET /api/beacon/summary`, `available`, `mtime`, `project`, `artifacts`, `timeline`
- Folio 스냅샷 Diff: `.beacon/snapshots/`

### 저장 모드 Beacon

1. 헤더에서 **Beacon** 선택 (available 일 때만 활성)
2. Journal/Docs/Board 저장 → `PUT /api/beacon/folio`
3. 파일: `.beacon/cache/folio-journals.json` / `folio-docs.json` / `folio-boards.json`
4. 원격(캐시) 실패·타임아웃(5초) 시에도 **로컬에는 이미 저장됨**

## 제약

- Vercel 등 서버리스에서는 로컬 `.beacon` FS가 없을 수 있음 → available=false, 프로세스 탭 제한
- WAL 모드 `beacon.db`는 서버에서 `node:sqlite` 등으로 읽음 (과거 sql.js WAL 이슈 수정됨)
- Folio가 Beacon CLI 상태를 “권위 있게” 덮어쓰지 않음 (`folio` 오버레이로 공존)
- Timeline 자동 기록은 동의 후에만

## 관련 코드

| 파일 | 역할 |
|------|------|
| `src/lib/beacon.ts` | 뷰모델 · 파싱 · watch · 스냅샷 · diff · 클라이언트 쓰기 |
| `src/lib/beacon-sync.ts` | project overlay · artifact export · folio timeline |
| `src/lib/beacon-automation.ts` | 자동 감지 · Gate PASS · Timeline 분석 |
| `src/lib/beacon-timeline-consent.ts` | Timeline 기록 동의 |
| `src/lib/storage.ts` | beacon 모드 save/load |
| `src/app/api/beacon/*` | summary · project · artifacts · timeline · folio · mtime · snapshots |
| `src/components/beacon.tsx` | 프로세스 패널 (편집 · 자동화) |
| `src/components/beacon-change-badge.tsx` | 헤더 변경 알림 뱃지 |
| `src/components/beacon-timeline-analytics.tsx` | Timeline 주/월·히트맵 |
| `src/components/beacon-diff.tsx` | 스냅샷 Diff 뷰 |
