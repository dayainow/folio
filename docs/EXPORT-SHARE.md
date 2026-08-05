# 내보내기 · 공유 · 임베드 · 클라우드 백업 (P60)

Phase 32 / P60 — Folio 내보내기·공유 고도화 (v**3.4.0** 정식).

## 내보내기

| 포맷 | 범위 | 구현 |
|------|------|------|
| Markdown (rich) | 일지 · 문서 · 보드 | YAML frontmatter · 태그 · `exportedAt` (`export-rich.ts`) |
| HTML | 일지 · 문서 · 보드 | 웹 게시용 단일 HTML 페이지 |
| PDF | 일지 · 문서 · 보드 | `jspdf` 클라이언트 생성 |

UI: 사이드바 **공유·내보내기** (`ExportSharePanel`).

## 공유 링크

- `POST /api/share` — 스냅샷 등록 (토큰 · 암호 해시 · 만료)
- `GET /api/share/[token]` — 읽기 전용 조회 (조회수++)
- `GET /api/share/[token]?download=1` — Markdown 다운로드 (다운로드수++)
- `DELETE /api/share/[token]` — 폐기
- 공개 페이지: `/share/[token]` · 임베드: `/share/[token]?embed=1`

서버 저장: 메모리 + `.data/shares/{token}.json` (gitignore).

암호: SHA-256 (`folio-share:` prefix). 만료 시 HTTP 410.

## 임베드

```html
<iframe src="https://host/share/{token}?embed=1" …></iframe>
```

패널에서 공유 생성 후 iframe 코드 복사. 읽기 전용·크롬 최소화.

## 클라우드 동기화

| 기능 | 버킷 / 키 | 비고 |
|------|-----------|------|
| 첨부 업로드 | `folio-attachments` | 미설정 시 data URL 폴백 |
| 자동 백업 | `folio-backups` | 실패 시 로컬 JSON 다운로드 |
| 스케줄 | `folio_backup_schedule_v1` | intervalHours · conflictStrategy |
| 충돌 해결 | `mergeDatasets` | merge / prefer-local / prefer-incoming |

Supabase Dashboard에서 Storage 버킷을 public 또는 authenticated로 생성하세요.

## 관련 파일

- `src/lib/export-rich.ts`
- `src/lib/share-links.ts` · `share-server-store.ts`
- `src/lib/cloud-backup.ts`
- `src/components/export-share-panel.tsx`
- `src/app/share/[token]/page.tsx`
- `src/app/api/share/**`
