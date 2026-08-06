# 테마 · 고대비 · 접근성 (P65)

Phase 37 / P65 — Light / Dark / System · 커스텀 프리셋 · WCAG 고대비 (v**3.9.0**).

## 기본 테마

| 모드 | 설명 |
|------|------|
| Light | 기본 라이트 |
| Dark | 전체 컴포넌트 다크 (`html.dark`) |
| System | OS `prefers-color-scheme` 자동 전환 |

사이드바 테마 아이콘을 누르면 Light → Dark → System 순환.  
전환 시 짧은 색상 애니메이션 (`html.theme-animating`).

## 고대비

- `html.high-contrast` — 흑/백 대비 · 굵은 테두리 · 포커스 3px+
- 다크+고대비 조합 지원
- 목표: WCAG **AAA** 지향 대비

## 커스텀 프리셋

- Primary / Accent 색 · 폰트(geist/serif/mono) · 글자 크기
- 저장: `folio_theme_presets_v1`
- JSON 내보내기(클립보드/파일) · 가져오기 · 공유

## 접근성 옵션 (`folio_appearance_v1`)

| 옵션 | 동작 |
|------|------|
| 글자 크기 | sm / md / lg / xl |
| 굵은 텍스트 | body·제목 강조 |
| 포커스 강화 | outline 4px + ring |
| 모션 | system / 항상 감소 / 허용 |

스크린 리더: 테마 변경 시 `announceToScreenReader`  
키보드: 스킵 링크 · 포커스 트랩 · 커맨드 팔레트 「테마/접근성」

## 관련 파일

- `src/lib/theme.ts` · `theme-presets.ts`
- `src/components/theme-toggle.tsx` · `theme-panel.tsx`
- `src/app/globals.css` · `layout.tsx` init script
- `docs/A11Y.md`
