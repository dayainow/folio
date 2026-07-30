# Folio ↔ Beacon 프로세스 연동 규약

`folio`(웹 워크스페이스)와 `beacon-project-os`(프로젝트 프로세스 루트)를 **별도 리포로 운영**하되, 실제 프로젝트 폴더를 원본으로 삼아 Folio가 읽기 전용으로 임베딩한다.

## 원칙

1. **Beacon 프로젝트 루트가 원본** — 프로세스 상태·산출물의 출처는 프로젝트 폴더다.
2. **두 리포 분리** — Folio UI/앱과 beacon-project-os CLI·규약은 각각 독립 저장소로 유지한다.
3. **CLI 원본 필드 보존** — `version` / `initializedAt` 등 CLI 필드는 Folio가 덮어쓰지 않는다.
4. **Folio 오버레이 (P23)** — 편집 내용은 `project.json` 의 `folio` 객체와 `folio.edits[]`(append-only)에 기록한다.
5. **UI보다 규약 우선** — 경로·파일 규약을 이 문서로 고정한다.

## Folio 탭 구조 (목표)

| 탭 | 역할 |
|----|------|
| 일지 | Journal |
| 문서 | Docs (+ Beacon export) |
| 일정 | Board |
| **프로세스** | Beacon 상태 뷰 + Folio 오버레이 편집 |

## 프로세스 탭이 읽는 파일 / DB

| 경로 | 용도 |
|------|------|
| `.beacon/beacon.db` | Beacon SQLite DB (읽기 전용) |
| `.beacon/project.json` | 프로젝트 메타 + Folio `folio` 오버레이 |
| `.beacon/folio-timeline.jsonl` | Folio Timeline append (동의 시) |
| `.beacon/artifacts/folio/**` | Docs export 산출물 |
| `.beacon/cache/folio-*.json` | 저장 모드 Beacon 캐시 |
| `PROCESS.md` | 이 규약 문서 |

## 편집 규칙 (P23)

- Folio는 `project.json`에 **append-only** 로 `folio.edits` 를 쌓고, `folio.gates` / `folio.artifacts` / `name` 오버레이를 갱신한다.
- `beacon.db` 는 쓰지 않는다 (Timeline은 jsonl).
- 외부(CLI) mtime 변경 시 충돌 → 병합(merge) 또는 재적용(reapply).
- Timeline 자동 기록은 **사용자 동의** 후에만 (기본 off).

## 연동 구현 상태

1. **`.beacon/project.json` 읽기** — ✅ P14
2. **Gate / P0–P4 상태 요약** — ✅ P14
3. **Timeline 요약** — ✅ P14
4. **산출물 체크리스트** — ✅ P14
5. **저장 모드 Beacon 캐시** — ✅ P14-2
6. **변경 감지 · Folio 스냅샷 Diff** — ✅ P21
7. **프로세스 편집 · Docs export · Timeline 동의** — ✅ P23
8. **자동 감지 · Gate 자동화 · Timeline 분석** — ✅ P24 (진행 중 UI)

## 변경 이력

- 2026-07-28: 초안 — 경로·탭·읽기 전용·연동 순서 정리
- 2026-07-28: P14 — 프로세스 탭 UI
- 2026-07-29: P14-2 — `.beacon/cache` 저장 모드
- 2026-07-30: P23 — Folio 양방향 오버레이 · artifact export · timeline 동의
- 2026-07-30: P24 — 자동 감지 Diff/알림 · Gate PASS · Docs auto artifact · Timeline 분석
