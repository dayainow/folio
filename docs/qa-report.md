# Folio QA 리포트 (P18)

**일시:** 2026-07-29  
**버전:** 0.6.0-wip  
**방법:** 코드 경로 리뷰 · API 스모크 · `npm run qa:smoke` · typecheck/lint

## 요약

| 결과 | 건수 |
|------|------|
| 통과 (코드/스모크 확인) | 다수 — 아래 매트릭스 |
| 발견 버그 → 수정 | 3 |
| 잔여 (수동 UI 권장) | Obsidian 파일 picker, 실계정 클라우드 로그인 |

스모크 스크립트: `npm run qa:smoke`  
체크리스트: README **QA 체크리스트** 섹션

---

## 테스트 매트릭스

### 일지 탭

| 항목 | 결과 | 비고 |
|------|------|------|
| 텍스트 입력 → 저장 → 날짜 이동 → 재진입 유지 | ✅ (수정 후) | 저장 flush + **날짜 이탈 시 자동 영속** 추가 |
| 태그 Enter/Backspace · 최근 기록 · 클라우드 필터 | ✅ | TagCloud `onSelect` 토글, recentEntries filter |
| Obsidian 가져오기 | ✅ (코드) | `readObsidianMarkdownFiles` · 날짜/태그 반영 경로 확인 |

### 문서 탭

| 항목 | 결과 | 비고 |
|------|------|------|
| 새 문서 → 편집 → 저장 → 읽기 모드 | ✅ | 낙관적 UI + `saveDocWithFallback` |
| 카테고리/검색/선택 | ✅ | filtered + selectDoc |
| 편집 중 다른 문서 선택 시 유실 | ✅ (수정) | 이동 전 자동 저장 |

### 일정 탭

| 항목 | 결과 | 비고 |
|------|------|------|
| 새 태스크 · 컬럼 + · 카드 표시 | ✅ | `openNewTask` / `composing` |
| 편집/삭제 · ←/→ 컬럼 이동 | ✅ | `qa:smoke` 상태 전이 검증 |
| DnD → status · localStorage | ✅ | `setTaskStatus` + flush in `saveTasks` |
| 태그/우선순위 · 검색 | ✅ | filtered · TagCloud |

### 프로세스 탭

| 항목 | 결과 | 비고 |
|------|------|------|
| `.beacon` 시 프로젝트 카드 | ✅ | `GET /api/beacon/summary` 200, available true |
| Gate P0–P4 · Timeline · 산출물 | ✅ | summary JSON에 stages/gate 포함 |

### 저장 모드

| 항목 | 결과 | 비고 |
|------|------|------|
| local / cloud / beacon 경로 | ✅ | `saveWithFallback` 로컬 선행 |
| **로그인 없으면 클라우드 비활성** | ✅ (수정) | 미로그인 시 cloud disabled · cloud→local 강등 |

### 통합 검색

| 항목 | 결과 | 비고 |
|------|------|------|
| 그룹화 · ⌘K · 클릭 시 탭 이동 | ✅ | GlobalSearch + page `handleSearchNavigate` |

### 다크모드

| 항목 | 결과 | 비고 |
|------|------|------|
| 토글 · 새로고침 유지 | ✅ | `folio_theme` + layout init script |

### 태그 클라우드 / 분석

| 항목 | 결과 | 비고 |
|------|------|------|
| 클릭 필터 · 해제 | ✅ | TagCloud |
| 기간 변경 → 차트 | ✅ (코드) | analytics `useEffect([range])` |

---

## 발견 버그 · 수정

| ID | 증상 | 수정 |
|----|------|------|
| B1 | 저장 모드에서 미로그인인데도 **클라우드** 선택 가능 | `StorageModeToggle`: auth 구독, cloud disabled, 로그아웃 시 local 강등 |
| B2 | 일지 날짜 이동 시 미저장 초안 유실 (자동저장 3초 전) | `selectDate`에서 이탈 전 `days` 병합 + `saveJournalWithFallback` |
| B3 | 문서 편집 중 다른 문서 클릭 시 미저장 내용 유실 | `selectDoc`에서 이동 전 `saveDocWithFallback` |

---

## 자동화

```bash
npm run qa:smoke      # debounce/flush · board 이동 · 태그 집계
npm run typecheck
npm run lint
curl localhost:3000/api/beacon/available   # available:true (로컬 .beacon)
curl localhost:3000/api/beacon/summary     # 200
```

---

## 잔여 수동 확인 권장

- [ ] Obsidian 다중 `.md` 실제 파일 선택 UI
- [ ] 로그인 후 클라우드 왕복 (실 Supabase 프로젝트)
- [ ] Board 마우스 DnD 드롭 시각 확인
- [ ] 분석 탭 차트 픽셀 확인 (동적 import)
