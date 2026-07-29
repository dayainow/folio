# 기본 사용 예시 (Basic usage)

로컬 전용으로 Folio를 쓰는 최소 시나리오.

## 1. 실행

```bash
cp docs/env.example .env.local
# Supabase 없이 로컬만 쓸 경우 URL/key는 placeholder여도 일지·문서는 동작
npm install && npm run dev
```

헤더 저장 모드가 **로컬**인지 확인한다.

## 2. 일지 작성

1. **일지** 탭 → 오늘 날짜 확인
2. 본문 입력 → **저장** (또는 3초 자동 저장)
3. 태그 입력 후 Enter · 빈 칸에서 Backspace로 태그 삭제
4. 우측 **최근 기록**에서 날짜 이동

## 3. 문서

1. **문서** 탭 → **새 문서**
2. 제목(필수) · 본문 마크다운 → **저장**
3. 편집 / 미리보기 / 분할 전환
4. (선택) Obsidian `.md` 여러 개 가져와 문서함 채우기

## 4. 일정

1. **일정** 탭 → **새 태스크** 또는 컬럼 `+`
2. 카드를 Tab으로 포커스 → ←/→ 로 컬럼 이동
3. 마우스로 드래그 앤 드롭도 가능

## 5. 검색

- 상단 검색창 또는 ⌘/Ctrl+K
- ↑/↓ · Enter로 결과 이동 · Escape로 닫기

## 6. 다크 모드

헤더 테마 토글로 light/dark 전환 (`localStorage`에 저장).

## 관련

- [GETTING-STARTED.md](../docs/GETTING-STARTED.md)
- [team-setup.md](./team-setup.md)
