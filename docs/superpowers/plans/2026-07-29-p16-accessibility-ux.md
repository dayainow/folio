# P16 접근성/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Folio 메인 워크스페이스(일지·문서·일정·프로세스)를 키보드·스크린 리더로 쓸 수 있게 하고, 포커스/ARIA/대비 기본선을 맞춘다.

**Architecture:** Base UI Tabs/Button의 기존 포커스 링을 유지한 채, 앱 셸(`page.tsx`)에 landmark·스킵 링크를 추가하고, Journal/Docs/Board/검색의 아이콘·상태·라이브 영역을 보강한다. DnD는 `@dnd-kit` KeyboardSensor를 켠다. 새 의존성 없이 CSS/`aria-*`/`role` 위주로 진행한다.

**Tech Stack:** Next.js 16 App Router, React 19, Base UI, Tailwind v4, `@dnd-kit/core`

## Global Constraints

- 응답·커밋 메시지: 한국어 (Conventional Commits)
- 기존 디자인 토큰/`focus-visible:ring-*` 패턴 유지
- YAGNI: axe 전용 CI·새 컴포넌트 라이브러리 추가 금지
- 검증: `npm run typecheck` · `npm run lint` · 키보드 수동 체크리스트

---

## File Map

| 파일 | 역할 |
|------|------|
| `src/app/layout.tsx` | `lang="ko"` 유지, (선택) `prefers-reduced-motion` 유틸 클래스 |
| `src/app/page.tsx` | skip link, `main`/`nav` landmark, 탭 전환 후 포커스 |
| `src/components/journal.tsx` | 저장 상태 `aria-live`, 날짜 네비 `aria-label`, 태그 리스트 라벨 |
| `src/components/docs.tsx` | 편집/미리보기 토글 `aria-pressed`, 문서 목록 `aria-current` |
| `src/components/board-dnd.tsx` | KeyboardSensor + 카드/컬럼 `aria-label` |
| `src/components/global-search.tsx` | 이미 listbox — 옵션 `aria-selected`/`id` 정합 점검 |
| `src/components/storage-mode-toggle.tsx` | 메뉴 `aria-expanded` / `aria-controls` |
| `docs/a11y-checklist.md` | 수동 검증 체크리스트 |
| `README.md` / `VERSION.md` | 작업 관리 |

---

### Task 1: Skip link + landmarks (앱 셸)

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css` (skip-link 스타일)
- Test: 수동 — Tab 첫 키로 스킵 링크 노출

**Interfaces:**
- Produces: `#main-content` id on `<main>`, skip `<a href="#main-content">`

- [ ] **Step 1: globals.css에 skip-link 유틸 추가**

```css
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 100;
  padding: 0.5rem 1rem;
  background: var(--background);
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
}
.skip-link:focus {
  left: 1rem;
  top: 1rem;
}
```

- [ ] **Step 2: page.tsx 루트에 스킵 링크 + landmark**

`return` 최상단:
```tsx
<a href="#main-content" className="skip-link">
  본문으로 건너뛰기
</a>
```
- `<header>` → 그대로, 내부 탭 `TabsList`에 `aria-label="주요 패널"`
- `<main id="main-content" tabIndex={-1} ...>`
- 푸터는 `<footer>` 유지

- [ ] **Step 3: 검증**

Run: `npm run typecheck && npm run lint`  
수동: Chrome에서 Tab → 「본문으로 건너뛰기」 포커스 → Enter → `#main-content`로 이동

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/globals.css
git commit -m "feat(a11y): 스킵 링크와 main landmark 추가"
```

---

### Task 2: Journal 저장·날짜·태그 접근성

**Files:**
- Modify: `src/components/journal.tsx`
- Test: 수동 — VoiceOver/Chrome 스크린 리더로 저장 상태 읽힘

**Interfaces:**
- Consumes: 기존 `saveState: 'idle' | 'saving' | 'saved' | 'error'`
- Produces: `aria-live="polite"` 상태 영역, 날짜 버튼 labels

- [ ] **Step 1: 저장 버튼/라이브 영역**

```tsx
<Button
  type="button"
  aria-busy={saveState === 'saving'}
  aria-live="polite"
  ...
>
```
별도 숨김 텍스트(권장):
```tsx
<span className="sr-only" aria-live="polite">
  {saveState === 'saved' ? '저장됨' : saveState === 'saving' ? '저장 중' : ''}
</span>
```
(`sr-only`가 없으면 Tailwind `sr-only` 사용)

- [ ] **Step 2: 날짜 네비·최근 기록**

```tsx
<Button aria-label="이전 날짜" ...>
<Button aria-label="다음 날짜" ...>
<button type="button" aria-current={date === d ? 'date' : undefined} ...>
```

- [ ] **Step 3: Textarea/태그 연결**

```tsx
<label htmlFor="journal-draft" className="sr-only">일지 본문</label>
<Textarea id="journal-draft" ... />
<label htmlFor="journal-tag-draft" className="sr-only">태그 입력</label>
```

- [ ] **Step 4: 검증 + Commit**

```bash
npm run typecheck && npm run lint
git add src/components/journal.tsx
git commit -m "feat(a11y): Journal 저장 상태·라벨·aria-live"
```

---

### Task 3: Docs 목록·편집 모드 ARIA

**Files:**
- Modify: `src/components/docs.tsx`

- [ ] **Step 1: 목록 항목 `aria-current="page"` (선택 문서)**

```tsx
<button
  type="button"
  aria-current={selectedId === doc.id ? 'true' : undefined}
  ...
>
```

- [ ] **Step 2: 편집/미리보기/분할 토글**

```tsx
<button type="button" aria-pressed={editPane === 'edit'} ...>편집</button>
<button type="button" aria-pressed={editPane === 'preview'} ...>미리보기</button>
<button type="button" aria-pressed={editPane === 'split'} ...>분할</button>
```

- [ ] **Step 3: 제목/본문 label**

`htmlFor` + `sr-only`로 `doc-title`, `doc-content` 연결

- [ ] **Step 4: 검증 + Commit**

```bash
git commit -m "feat(a11y): Docs 목록·편집 모드 ARIA"
```

---

### Task 4: Board 키보드 DnD + 카드 라벨

**Files:**
- Modify: `src/components/board-dnd.tsx`

**Interfaces:**
- Produces: `KeyboardSensor` + `sortableKeyboardCoordinates` (이미 `@dnd-kit` 의존성에 포함)

- [ ] **Step 1: 센서에 KeyboardSensor 추가**

```tsx
import {
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
)
```

`@dnd-kit/sortable` 미설치 시:
```bash
npm install @dnd-kit/sortable
```
(프로젝트에 이미 있으면 설치 스킵 — `package.json` 확인)

- [ ] **Step 2: 카드/컬럼 접근성 이름**

```tsx
// 카드 루트
aria-label={`${task.title}, ${task.status}`}
// 컬럼 + 버튼
aria-label={`${columnLabel}에 태스크 추가`}
```

- [ ] **Step 3: 수동 키보드**

Tab으로 카드 포커스 → Space/Enter로 집기 → 화살표로 이동 → Space/Enter로 놓기 (dnd-kit 기본)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(a11y): Board KeyboardSensor와 카드 aria-label"
```

---

### Task 5: 검색·저장모드·대비·체크리스트

**Files:**
- Modify: `src/components/global-search.tsx` (옵션 `id` / `aria-activedescendant` 정합)
- Modify: `src/components/storage-mode-toggle.tsx`
- Create: `docs/a11y-checklist.md`
- Modify: `README.md`, `VERSION.md`

- [ ] **Step 1: StorageModeToggle**

트리거: `aria-expanded={open}` `aria-controls="storage-mode-menu"`  
메뉴: `id="storage-mode-menu" role="menu"` 항목 `role="menuitemradio"` `aria-checked`

- [ ] **Step 2: global-search activedescendant**

활성 옵션에 `id={`${panelId}-opt-${i}`}` 부여, input에 `aria-activedescendant={activeId}`

- [ ] **Step 3: docs/a11y-checklist.md 작성**

포함 항목:
1. Skip link
2. 탭 키보드 (화살표/Home/End — Base UI 기본)
3. Journal 저장 live region
4. Docs 편집 토글 pressed
5. Board 키보드 DnD
6. 검색 listbox
7. 다크/라이트 대비 (본문/버튼)
8. `prefers-reduced-motion` (있다면 존중)

- [ ] **Step 4: README/VERSION — P16 진행 중으로 갱신**

- [ ] **Step 5: 전체 검증 + Commit**

```bash
npm run typecheck && npm run lint
git add -A
git commit -m "feat(a11y): 검색·저장모드 ARIA와 체크리스트"
git push
```

---

## Out of scope (의도적)

- 자동화 axe CI / Playwright a11y 스위트
- 전체 카피 영문화
- DnD 완전 대체(터치 전용 모드)
- WCAG AAA

## Spec coverage

| 요구 | Task |
|------|------|
| 키보드 네비게이션 | 1, 4, 5 |
| 포커스 | 1 (skip/main), 2–3 labels |
| ARIA | 2–5 |
| 대비 | 5 체크리스트 + 기존 토큰 유지 |
| reduced motion | 5 체크리스트 (최소: 존중 여부 문서화) |
