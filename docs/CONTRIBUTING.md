# Folio 기여 가이드

Folio에 기여해 주셔서 감사합니다. 아래 절차를 따르면 리뷰와 병합이 빨라집니다.

## 개발 환경

- Node.js 20+
- npm 10+

```bash
git clone https://github.com/dayainow/folio.git
cd folio
cp docs/env.example .env.local   # 필요 시 값 채우기
npm install
npm run dev
```

## 품질 게이트 (PR 전 필수)

```bash
npm run lint          # eslint --max-warnings 0
npm run typecheck
npm run test          # typecheck 포함
npm run qa:smoke      # 핵심 로직 스모크
```

가능하면 `npm run build`까지 통과시켜 주세요.

## 브랜치 · 커밋

1. `main`에서 feature/fix 브랜치를 만듭니다.
2. 커밋 메시지는 [Conventional Commits](https://www.conventionalcommits.org/) + **한국어** 요약을 사용합니다.
   - 예: `feat: Docs 역링크 패널 추가`, `fix: Journal 자동저장 레이스 수정`
3. 의미 있는 기능/문서 변경이면 `README.md` 작업 관리와 `VERSION.md`를 함께 갱신합니다.
4. PR에는 변경 요약 · 테스트 방법을 적어 주세요.

## 코드 가이드

- UI는 기존 Folio 패턴(shadcn/ui · Tailwind · writing-first 레이아웃)을 따릅니다.
- 저장은 `local` / `cloud` / `beacon` 모드와 폴백을 깨지 않도록 주의합니다.
- 클라이언트에서 시크릿(API 키·토큰)을 노출하지 않습니다. 서버 라우트/env를 사용합니다.
- `console.log`·주석 처리된 코드·미사용 import는 PR에 남기지 않습니다.
- Next.js API·파일 구조는 `node_modules/next/dist/docs/` 및 프로젝트 `AGENTS.md`를 우선합니다.

## 문서

| 문서 | 용도 |
|------|------|
| [GETTING-STARTED.md](./GETTING-STARTED.md) | 설치·시작 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 구조 |
| [API.md](./API.md) | API |
| [DEPLOY.md](./DEPLOY.md) | 배포 |
| [MCP-GUIDE.md](./MCP-GUIDE.md) | MCP 사용 |
| [VERSION.md](../VERSION.md) | 버전·Phase 이력 |

## 이슈 · 보안

- 버그/기능 요청은 GitHub Issues를 사용합니다.
- 보안 이슈는 공개 이슈 대신 저장소 관리자에게 私下 보고해 주세요.

## 라이선스

기여분은 프로젝트 라이선스(All rights reserved / private)에 따릅니다.
