# Folio ↔ Beacon 프로세스 연동 규약

`folio`(웹 워크스페이스)와 `beacon-project-os`(프로젝트 프로세스 루트)를 **별도 리포로 운영**하되, 실제 프로젝트 폴더를 원본으로 삼아 Folio가 읽기 전용으로 임베딩한다.

## 원칙

1. **Beacon 프로젝트 루트가 원본** — 프로세스 상태·산출물의 출처는 프로젝트 폴더다.
2. **두 리포 분리** — Folio UI/앱과 beacon-project-os CLI·규약은 각각 독립 저장소로 유지한다.
3. **Folio는 읽기만** — Beacon CLI가 생성하는 파일·DB는 Folio에서 **쓰지 않는다**.
4. **UI보다 규약 우선** — 프로세스 탭 임베딩 전에 경로·파일 규약을 이 문서로 고정한다.

## 경로 (이 워크스페이스)

| 항목 | 경로 |
|------|------|
| Beacon 프로젝트 루트 | `/Users/dobedub/Documents/source/ax/folio` |
| `.beacon/` | `/Users/dobedub/Documents/source/ax/folio/.beacon` |

> 다른 머신·클론에서는 프로젝트 루트를 해당 checkout 경로로 치환한다. Folio 설정(향후)에는 절대/상대 루트를 한 번만 지정한다.

## Folio 탭 구조 (목표)

| 탭 | 역할 |
|----|------|
| 일지 | Journal |
| 문서 | Docs |
| 일정 | Board |
| **프로세스** | Beacon 상태 읽기 전용 뷰 |

현재 구현은 일지/문서/일정(+통계·분석)과 **프로세스** 탭(`BeaconPanel`)이다.

## 프로세스 탭이 읽는 파일 / DB

모두 **읽기 전용**. Folio는 생성·수정·삭제를 하지 않는다.

| 경로 | 용도 |
|------|------|
| `.beacon/beacon.db` | Beacon SQLite DB (읽기 전용) |
| `.beacon/project.json` | 프로젝트 메타·현재 단계 요약 |
| `PROCESS.md` | 이 규약 문서 (루트) |
| (선택) Project Book 등 Beacon이 두는 마크다운 | 프로세스 설명·체크리스트 표시 |

Beacon CLI가 추가로 만드는 산출물도 동일하게 **읽기만** 허용한다.

## 편집 금지 원칙

- Folio UI·API·마이그레이션은 `.beacon/**` 및 Beacon 생성 파일을 **업데이트하지 않는다**.
- 프로세스 변경은 **Beacon CLI / beacon-project-os** 측에서만 수행한다.
- Folio는 캐시·표시용 파생 상태만 메모리(또는 Folio 전용 스토리지)에 둘 수 있으며, `.beacon`에 다시 쓰지 않는다.

## 향후 연동 순서

1. **`.beacon/project.json` 읽기** — ✅ P14
2. **Gate / P0–P4 상태 요약** — ✅ P14 (`beacon.db` 스냅샷)
3. **Timeline 요약** — ✅ P14
4. **산출물 체크리스트** — ✅ P14

구현:

- `/api/beacon/summary` — Node에서 `BEACON_PROJECT_ROOT` 또는 `cwd` 아래 `.beacon` 읽기
- 브라우저 File System Access API — 서버 FS가 없을 때 `.beacon` 폴더 선택
- `sql.js`로 `beacon.db` Timeline / 최신 스냅샷 파싱 (읽기 전용)

## 리포 관계 (요약)

```
beacon-project-os     →  CLI / 규약 / .beacon 스키마 (쓰기)
        ↓ (프로젝트 폴더에 .beacon 생성)
프로젝트 루트 (.beacon/, PROCESS.md, …)
        ↓ (읽기 전용)
folio                 →  프로세스 탭 UI (임베딩)
```

## 변경 이력

- 2026-07-28: 초안 — 경로·탭·읽기 전용·연동 순서 정리
- 2026-07-28: P14 — 프로세스 탭 UI (`/api/beacon/summary`, sql.js, 폴더 선택)
