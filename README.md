# Folio

![Dashboard](screenshots/dashboard.png)

**프로젝트의 기록, 한 곳에서.**

Folio는 개발자의 일지·문서·일정·프로세스를 하나로 묶는 워크스페이스입니다.
Obsidian으로 메모하고, Notion으로 문서를 관리하고, Jira로 일정을 tracking하는 흐름을,
**한 화면에서**, **한 도구에서** 끝낼 수 있습니다.

---

## 왜 Folio인가?

| 도구 | 역할 |
|------|------|
| **Obsidian** | 개인 메모, 생각 정리, 지식 그래프 |
| **Notion** | 팀 공통 문서, 정책, 가이드 |
| **Jira** | 프로젝트 일정, 이슈 트래킹 |
| **Folio** | **이 셋을 하나의 워크스페이스로 통합** |

Folio는 로컬 우선으로 시작해 팀 공유까지 확장할 수 있습니다.
모든 데이터는 브라우저 또는 Supabase/Beacon에 저장되며, 언제든지 Markdown/CSV/JSON으로 내보낼 수 있습니다.

---

## 핵심 기능

**📓 일지 (Journal)**
- 날짜별 업무 기록, 자동 저장
- 태그 기반 분류 & 자동완성
- Obsidian `.md` 파일 일괄 가져오기
- 주간/월간 통계 차트

**📄 문서 (Docs)**
- 마크다운 편집 & 실시간 프리뷰
- 카테고리별 분류 & 통합 검색
- 문서 간 `[[링크]]` 그래프 시각화
- 팀 공유를 위한 Supabase 동기화

**📋 일정 (Board)**
- 4컬럼 칸반: Backlog → In Progress → Review → Done
- drag & drop 또는 키보드로 상태 변경
- Jira 이슈 동기화 & 외부 링크
- 우선순위·태그·즐겨찾기

**⚙️ 프로세스 (Beacon)**
- 프로젝트 Gate(P0-P4) 상태 추적
- Timeline & 산출물 체크리스트
- 변경 감지 & Diff 뷰
- 자동 스냅샷

**🔍 통합 검색**
- `Cmd/Ctrl + K`로 즉시 검색
- 일지·문서·일정 전체에서 일치 결과
- relevance 순 정렬

**☁️ 저장 모드**
- **로컬**: 브라우저 localStorage, 오프라인 가능
- **클라우드**: Supabase, 멀티유저·팀 공유
- **Beacon**: `.beacon` 프로젝트 상태와 연동

**📱 PWA & 오프라인**
- 설치 가능한 웹 앱
- 오프라인 편집 & 자동 동기화
- 브라우저 푸시 알림

**🔗 내보내기**
- Markdown, CSV, JSON, ZIP
- 보고·공유·백업을 원터치로

**🤖 MCP 연동**
- IDE·Git·CLI에서 Folio 기록을 직접 읽고 쓰기

---

## 빠른 시작

```bash
git clone https://github.com/dayainow/folio.git
cd folio
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 열기.

---

## 사용 가이드

| 주제 | 문서 |
|------|------|
| 설치·시작 | [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) |
| 아키텍처 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 배포 | [docs/DEPLOY.md](docs/DEPLOY.md) |
| Beacon 연동 | [docs/BEACON.md](docs/BEACON.md) |
| 접근성 | [docs/A11Y.md](docs/A11Y.md) |
| API 레퍼런스 | [docs/API.md](docs/API.md) |

---

## 개발

```bash
# 빌드 & 린트
npm run build
npm run lint

# QA 스모크 테스트
npm run qa:smoke

# 백업 스크립트
npm run runbook:backup
```

자세한 내용은 [CONTRIBUTING](docs/CONTRIBUTING.md) 참고.

---

## 로드맵

- **v1.0**: 일지·문서·일정·검색·다크모드·팀 공유·배포
- **v1.1**: 링크 그래프·내보내기·MCP 연동
- **v1.2**: AI 요약·고급 분석·Slack 고급
- **v2.0**: 모바일 네이티브·실시간 협업

전체 로드맵: [VERSION.md](VERSION.md)

---

## 라이선스

Copyright (c) dayainow. All rights reserved.

---

**Folio** — 프로젝트의 기록, 한 곳에서.
