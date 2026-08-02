# Folio 기여 가이드

Folio에 기여해 주셔서 감사합니다. 아래 절차를 따르면 리뷰와 병합이 빨라집니다.

## 개발 환경

- Node.js 20+
- npm 10+

```bash
git clone https://github.com/dayainow/folio.git
cd folio
cp docs/env.example .env.local
npm install
npm run dev
```

## 품질 게이트 (PR 전 필수)

```bash
npm run lint
npm run typecheck
npm run test
npm run qa:smoke
npm run bundle:size   # 빌드 후 권장
```

가능하면 `npm run build`까지 통과시켜 주세요.

### PR 체크리스트

- [ ] Conventional Commit + 한국어 요약
- [ ] `lint` / `typecheck` / `test` / `qa:smoke` 통과
- [ ] 의미 있는 변경 시 `README.md` · `VERSION.md` 갱신
- [ ] 시크릿·`.env.local` 커밋 없음
- [ ] UI 변경 시 키보드·포커스·aria 확인 ([A11Y.md](./A11Y.md))
- [ ] 저장 모드 폴백을 깨지 않음
- [ ] 새 유틸에 테스트 추가 (가능하면)

## 커밋 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/) + **한국어** 요약.

| 타입 | 예 |
|------|-----|
| `feat` | `feat: Docs 역링크 패널 추가` |
| `fix` | `fix: Journal 자동저장 레이스 수정` |
| `chore` | `chore: v2.0.0 release …` |
| `docs` | `docs: MIGRATION 가이드 추가` |
| `test` | `test: analytics 스코어 단위 테스트` |
| `refactor` | `refactor: storage 모드 헬퍼 분리` |
| `style` | `style: import 정리` |

사용자가 커밋 메시지를 지정하면 그 메시지를 우선합니다.

## 코드 리뷰 기준

1. **정확성** — 버그·레이스·데이터 손실 없음
2. **보안** — XSS/시크릿/CSP 위반 없음
3. **접근성** — 키보드·aria·대비
4. **성능** — 불필요한 클라이언트 번들 증가 최소화
5. **일관성** — 기존 Folio 패턴(shadcn · Tailwind · WithFallback)
6. **테스트** — 순수 로직 변경에 테스트 동반

## 테스트

상세: [TESTING.md](./TESTING.md)

```bash
npm run test
npm run test:watch
```

## 코드 가이드

- TypeScript `any` 금지에 가깝게 유지
- `console.log`·주석 코드·미사용 import 남기지 않음
- 에러는 `logError` / `toUserErrorMessage` 패턴 권장
- Next.js는 `node_modules/next/dist/docs/` · `AGENTS.md` 우선

## 문서

| 문서 | 용도 |
|------|------|
| [GETTING-STARTED.md](./GETTING-STARTED.md) | 설치 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | v2.0 구조 |
| [MIGRATION.md](./MIGRATION.md) | 1.x → 2.0 |
| [TESTING.md](./TESTING.md) | 테스트 |
| [PERFORMANCE.md](./PERFORMANCE.md) | 성능 예산 |
| [A11Y.md](./A11Y.md) | 접근성 |
| [VERSION.md](../VERSION.md) | 이력 |

## 라이선스

기여분은 프로젝트 라이선스(All rights reserved / private)에 따릅니다.
