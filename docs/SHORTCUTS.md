# 커맨드 팔레트 · 단축키 · 슬래시 명령 (P64)

Phase 36 / P64 — 키보드 중심 내비게이션 (v**3.8.0-wip**).

## 커맨드 팔레트

- 단축키: **⌘/Ctrl+K**
- 전체 명령 검색 (일지 작성, 문서, 태스크, 설정, 내보내기…)
- 최근 사용 명령 상단 추천 (`folio_command_recent_v1`)

UI: `CommandPalette` · `ProductivityHost`

## 기본 단축키

| 단축키 | 동작 |
|--------|------|
| ⌘/Ctrl+K | 커맨드 팔레트 |
| ⌘/Ctrl+N | 새 일지 (Quick Capture) |
| ⌘/Ctrl+Shift+N | 새 문서 |
| ⌘/Ctrl+Shift+T | 새 태스크 |
| ⌘/Ctrl+/ | 단축키 도움말 |
| ⌘/Ctrl+Shift+F | 통합 검색 |
| ⌘/Ctrl+Shift+G | 가이드 (`/guide`) |
| ⌘/Ctrl+Shift+E | 내보내기·공유 |
| ⌘/Ctrl+Shift+P | 플러그인 |

설정에서 커스터마이징: 사이드바 **단축키** · `folio_shortcut_bindings_v1`

## 슬래시 명령

에디터에서 `/` 입력 → 머리말 · 태그 · 목록 · 템플릿 등  
적용: 일지(`CollabTextarea`) · 문서(`WikiLinkTextarea`)

## 관련 파일

- `src/lib/shortcuts.ts` · `command-registry.ts` · `slash-commands.ts`
- `src/components/command-palette.tsx` · `shortcut-settings.tsx` · `slash-command-menu.tsx`
- `src/components/productivity-host.tsx`
