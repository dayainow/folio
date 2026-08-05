# 문서 버전 관리 (P59)

문서(Docs) 스냅샷 · Diff · 복원/체크아웃 · 자동 저장.

## 기능

| 기능 | 설명 |
|------|------|
| **스냅샷** | 수동 · 중요 변경 · 체크포인트 · 5분 자동 |
| **라벨** | `v1.0` · `v1.1` … (major/minor) |
| **Diff** | 라인/단어 비교 (`DocDiffViewer`) |
| **복원** | 선택한 버전 내용으로 현재 문서 덮어쓰기 |
| **체크아웃** | 버전을 새 편집 상태로 불러오기 |
| **저장소** | `localStorage` `folio_doc_versions_v1` (문서당 최대 80) |

## UI

문서 탭에서:

1. 에디터 상단 **버전** 셀렉트 (`DocVersionSelect`)
2. 사이드 **버전 이력** 패널 (`DocVersionsPanel`) — 수동 스냅샷 · 비교 · 복원
3. Diff 모달에서 복원/체크아웃

## API

- `src/lib/doc-versions.ts` — `createDocSnapshot` · `createManualDocVersion` · `listDocVersions` · `restore`/`checkout` helpers
- `src/components/doc-versions-panel.tsx` · `doc-diff.tsx`
