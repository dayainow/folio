# Folio MCP 사용 매뉴얼 (간단판)

다른 프로젝트에서 작업한 내용을 Folio에 쌓고, Folio 화면에서 보는 방법입니다.

---

## 한 줄 요약

```text
다른 프로젝트 ←(MCP)→ Folio 서버(.folio-mcp) ←(MCP 가져오기)→ Folio 화면
```

1. **연결**: `npm run mcp:link` 한 번  
2. **자동 기록**: Cursor 에이전트가 작업 후 일지/보드에 남김  
3. **화면 반영**: Folio 앱 헤더 **「MCP 가져오기」**

---

## 1. 준비 (Folio 쪽, 1회)

```bash
cd /Users/dobedub/Documents/source/ax/folio
npm install
```

---

## 2. 다른 프로젝트에 Folio MCP 붙이기 (추천)

대상 프로젝트 경로만 넣으면 MCP 설정 + 자동기록 규칙이 설치됩니다.

```bash
cd /Users/dobedub/Documents/source/ax/folio

# 예: my-app 프로젝트에 연결
npm run mcp:link -- /Users/dobedub/Documents/source/my-app --name my-app
```

설치되는 것:

| 파일 | 역할 |
|------|------|
| `.cursor/mcp.json` | Cursor용 Folio MCP 연결 |
| `.vscode/mcp.json` | VS Code/Cursor 호환 |
| `.cursor/rules/folio-worklog.mdc` | 작업 후 자동 기록 규칙 |
| `FOLIO-MCP.md` | 짧은 안내 |

옵션:

```bash
npm run mcp:link -- /path/to/project --folio /path/to/folio --name slug --force
```

---

## 3. Cursor에서 확인

1. **대상 프로젝트**를 Cursor로 연다 (Folio가 아님).
2. **Settings → MCP** 에서 `folio`가 Connected / 녹색인지 확인.
3. Agent 채팅으로 작업한다.
4. 기능 구현이 끝나면 에이전트가 알아서 `journal_write` 등을 호출한다.  
   (규칙이 켜져 있음. 안 하면 “Folio에 남겨줘”라고 말하면 됨.)

수동으로 남기고 싶을 때:

> 오늘 한 작업 Folio 일지에 append로 남겨줘. 태그는 `my-app`.

---

## 4. Folio 화면에서 보기

MCP 기록은 먼저 `.folio-mcp/` 파일에 쌓입니다. UI로 가져오려면:

```bash
cd /Users/dobedub/Documents/source/ax/folio
npm run dev
# http://localhost:3000
```

헤더 오른쪽 **「MCP 가져오기」** 클릭 → 새로고침 확인.

그다음 **일지 / 문서 / 일정** 탭에서 내용을 확인합니다.

---

## 5. Git 푸시로도 쌓기 (선택)

커밋마다 자동 기록하려면:

1. Folio를 배포하거나 로컬에서 `npm run dev`
2. GitHub Repo → Webhooks →  
   `https://<folio-host>/api/mcp/git-webhook`
3. Secret = `.env`의 `FOLIO_MCP_WEBHOOK_SECRET`

로컬 테스트:

```bash
npm run mcp:client -- webhook '{"message":"feat: demo from other project","author":"you"}'
```

---

## 6. CLI로 직접 확인 (선택)

```bash
cd /Users/dobedub/Documents/source/ax/folio

npm run mcp:client -- tools
npm run mcp:client -- call journal_read '{}'
npm run mcp:client -- call board_list '{}'
```

---

## 자주 묻는 질문

### Q. 다른 프로젝트에서 작업했는데 Folio UI에 안 보여요
**「MCP 가져오기」**를 눌러야 브라우저 저장소로 병합됩니다.

### Q. 에이전트가 안 남겨요
- MCP `folio` 연결 상태 확인  
- `.cursor/rules/folio-worklog.mdc` 존재 확인  
- “Folio에 남겨줘”라고 한 번 요청

### Q. 데이터가 어디에 저장되나요?
`FOLIO_ROOT/.folio-mcp/journals.json` 등  
(브라우저 localStorage와는 별도 → 가져오기로 합침)

### Q. 수동으로 MCP JSON만 복사하고 싶어요
템플릿: `templates/external-project/`  
`__FOLIO_ROOT__`를 Folio 절대 경로로 바꿔 사용.

---

## 관련 문서

- 상세 스펙: [MCP.md](./MCP.md)
- 환경변수: [env.example](./env.example) (`FOLIO_MCP_*`)
