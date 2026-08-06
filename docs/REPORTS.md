# 내보내기 · 리포트 고도화 (P63)

Phase 35 / P63 — PDF · 인쇄 · 자동 리포트 · 템플릿 (v**3.7.0-wip**).

## PDF

| 대상 | 범위 | API |
|------|------|-----|
| 일지 | 일별 · 주별 · 월별 | `exportJournalDayPdf` / `Week` / `Month` |
| 문서 | 개별 · 카테고리별 | `exportDocPdfAdvanced` / `exportDocsByCategoryPdf` |
| 보드 | 전체 · 상태 필터 | `exportBoardPdfAdvanced` |

레이아웃 (`PdfLayoutOptions`):

- 용지: **A4** / **Letter**
- 여백(mm) · **표지** · **목차** · **쪽 번호**

구현: `src/lib/pdf-layout.ts` · `src/lib/export-advanced.ts`

## 인쇄

- `buildPrintableHtml` + `openPrintPreview` — 미리보기 창에서 인쇄
- HTML export에 `@media print` / `@page`
- 앱 전역: `globals.css` 인쇄 시 헤더·사이드바 숨김

## 자동 리포트

| 종류 | 기본 포함 |
|------|-----------|
| 주간 | 요약 · 일지 · 태스크 · Gate · 통계 |
| 월간 | + 트렌드 · 성과 |
| 프로젝트 | 최근 30일 · 전 섹션 |

다운로드: **MD / HTML / PDF** · 선택적 **이메일** (`sendEmailNotification`)

## 템플릿

- localStorage `folio_report_templates_v1`
- 섹션 포함/제외 · 순서 변경 · 주간/월간/프로젝트별 저장

UI: 헤더 **리포트** (`ReportsPanel`)

## 관련 파일

- `src/lib/pdf-layout.ts`
- `src/lib/export-advanced.ts`
- `src/lib/reports.ts`
- `src/components/reports-panel.tsx`
- `docs/EXPORT-SHARE.md` (P60 공유·기본 내보내기)
