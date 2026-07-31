# Folio MCP 연동 (P33) — 레퍼런스

> **처음 쓰는 분:** 간단 매뉴얼 → **[MCP-GUIDE.md](./MCP-GUIDE.md)**  
> 다른 프로젝트 연결: `npm run mcp:link -- /path/to/project --name my-app`

Model Context Protocol로 IDE·CLI·Git이 Folio 기록(일지·문서·보드·Timeline)과 양방향 연동한다.

## 도구 (Tools)

| 이름 | 별칭 | 설명 |
|------|------|------|
| `journal_read` | journal.read | 일지 읽기 |
| `journal_write` | journal.write | 일지 쓰기 (`append` 지원) |
| `doc_read` | doc.read | 문서 읽기 (id/title) |
| `doc_write` | doc.write | 문서 생성/수정 |
| `board_list` | board.list | 태스크 목록 |
| `board_update` | board.update | 태스크 생성/수정 |

> MCP 도구명 규칙상 `.` 대신 `_` 를 사용한다. `title` 필드에 `journal.read` 형태를 남겨 두었다.

## 리소스 (Resources)

| URI | 내용 |
|-----|------|
| `folio://journals` | 전체 일지 JSON |
| `folio://docs` | 전체 문서 JSON |
| `folio://boards` | 전체 보드 JSON |

데이터 위치: `.folio-mcp/{journals,docs,boards}.json`  
(없으면 `.beacon/cache/folio-*.json` 폴백)

## 프롬프트

| 이름 | 제목 |
|------|------|
| `daily_summary` | 오늘의 업무 요약 |
| `project_status` | 프로젝트 진행 상황 |

## IDE 연결 (VS Code / Cursor)

1. 저장소에 [`.vscode/mcp.json`](../.vscode/mcp.json) 이 포함되어 있다.
2. Cursor: Settings → MCP 에서 `folio` 서버가 보이는지 확인하거나, 동일 JSON을 사용자 MCP 설정에 추가.
3. 수동 등록 예:

```json
{
  "mcpServers": {
    "folio": {
      "command": "npx",
      "args": ["tsx", "src/mcp/stdio.ts"],
      "cwd": "/absolute/path/to/folio"
    }
  }
}
```

4. 의존성: `npm install` 후 `npx tsx` 사용 가능해야 한다.
5. 환경변수:
   - `FOLIO_MCP_ROOT` — 프로젝트 루트 (기본: cwd)
   - `FOLIO_MCP_DATA_DIR` — 데이터 디렉터리 (기본: `.folio-mcp`)

## HTTP 서버

Next.js 앱 실행 중:

```bash
npm run dev
# MCP Streamable HTTP
curl -sS http://localhost:3000/api/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

## Git Webhook

엔드포인트: `POST /api/mcp/git-webhook`

### GitHub

1. Repo → Settings → Webhooks → Add webhook  
2. Payload URL: `https://<host>/api/mcp/git-webhook`  
3. Content type: `application/json`  
4. Secret: `FOLIO_MCP_WEBHOOK_SECRET` 와 동일하게  
5. Event: Just the push event  

푸시 시 각 커밋에 대해:

- Beacon Timeline에 `Git · <메시지>` 기록 (가능 시)
- 오늘 일지에 `- [git] …` 한 줄 append + 태그 `git`
- Conventional Commit(`feat:`/`fix:` …)이면 Board 태스크 자동 생성

### 단순 CLI/curl

```bash
curl -sS http://localhost:3000/api/mcp/git-webhook \
  -H 'content-type: application/json' \
  -H "x-folio-mcp-secret: $FOLIO_MCP_WEBHOOK_SECRET" \
  -d '{"message":"feat: add mcp bridge","author":"you","id":"abc1234"}'
```

## CLI

```bash
# stdio MCP 서버에 도구 호출
npm run mcp:client -- tools
npm run mcp:client -- call journal_read '{"date":"2026-07-31"}'
npm run mcp:client -- call board_list '{}'

# HTTP (dev 서버 필요)
npm run mcp:client -- --http http://localhost:3000/api/mcp tools
```

자세한 옵션: `npm run mcp:client -- --help`
