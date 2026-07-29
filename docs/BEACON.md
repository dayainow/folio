# Folio ↔ Beacon 연동 (BEACON)

Folio **프로세스** 탭과 저장 모드 `Beacon`이 Beacon Project OS와 어떻게 맞물리는지 정리한다.  
규약 원문: [PROCESS.md](../PROCESS.md)

## 원칙

1. **Beacon 프로젝트 루트가 원본** — 프로세스 상태·산출물의 출처
2. **Folio는 읽기 전용** — `project.json` / `beacon.db` 등 CLI 산출물을 수정하지 않음
3. **Folio 캐시는 별도** — `.beacon/cache/folio-*.json` 만 기록 가능
4. **두 리포 분리** — Folio UI와 beacon-project-os CLI는 독립 저장소

## 경로

| 항목 | 기본값 | 환경변수 |
|------|--------|----------|
| 프로젝트 루트 | `process.cwd()` | `BEACON_PROJECT_ROOT` |
| Beacon 디렉터리 | `<root>/.beacon` | — |
| DB | `.beacon/beacon.db` | — |
| Folio 캐시 | `.beacon/cache/folio-journals.json` 등 | — |

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
- API: `GET /api/beacon/summary`, `GET /api/beacon/available`
- `.beacon`이 없으면 안내 UI + (가능 시) 폴더 선택

### 저장 모드 Beacon

1. 헤더에서 **Beacon** 선택 (available 일 때만 활성)
2. Journal/Docs/Board 저장 → `PUT /api/beacon/folio`
3. 파일: `.beacon/cache/folio-journals.json` / `folio-docs.json` / `folio-boards.json`
4. 원격(캐시) 실패·타임아웃(5초) 시에도 **로컬에는 이미 저장됨**

## 제약

- Vercel 등 서버리스에서는 로컬 `.beacon` FS가 없을 수 있음 → available=false, 프로세스 탭 제한
- WAL 모드 `beacon.db`는 서버에서 `node:sqlite` 등으로 읽음 (과거 sql.js WAL 이슈 수정됨)
- Folio가 Beacon CLI 상태를 “권위 있게” 덮어쓰지 않음

## 관련 코드

| 파일 | 역할 |
|------|------|
| `src/lib/beacon.ts` | 뷰모델 · DB/JSON 파싱 |
| `src/lib/storage.ts` | beacon 모드 save/load |
| `src/app/api/beacon/*` | available · summary · folio cache |
| `src/components/beacon.tsx` | 프로세스 패널 |
