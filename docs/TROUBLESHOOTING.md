# Folio 문제 해결

자주 겪는 문제와 해결 순서입니다.  
그래도 안 되면 `npm run lint` · `npm run typecheck` · 브라우저 콘솔을 확인하세요.

---

## 저장이 안 될 때

### 증상
- 저장 버튼이 **실패**로 바뀜
- 새로고침 후 내용이 사라짐

### 확인 순서
1. **저장 모드** 확인 (사이드바)
   - `local`: 시크릿/프라이빗 모드·용량 초과 여부
   - `cloud`: 로그인 여부 · Supabase env · 네트워크
   - `beacon`: `.beacon` 경로 · 서버가 FS에 쓸 수 있는지
2. 브라우저 **로컬 저장소**가 차단되지 않았는지 (사이트 설정)
3. 일지/문서는 **다시 시도** 버튼으로 재저장
4. 다른 탭에서 같은 앱을 열어 덮어쓰지 않았는지 확인

### 응급 조치
- 내용을 드래그해 복사해 둔 뒤 **전체 내보내기** 또는 텍스트 파일로 백업
- `local` 모드로 전환 후 다시 저장

---

## 로그인이 안 될 때

### 증상
- `/login` 에서 오류 · 세션이 유지되지 않음

### 확인 순서
1. `.env.local` 에 다음이 있는지
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Supabase 대시보드에서 Email 로그인이 켜져 있는지
3. 스키마/마이그레이션 적용 여부 ([supabase-schema.sql](./supabase-schema.sql))
4. `npm run dev` 재시작 (env 변경 후 필수)
5. 사이트 URL이 Supabase Redirect URL 허용 목록에 있는지

### 우회
- 개인 사용만 필요하면 **local** 모드로 로그인 없이 사용

---

## Beacon이 연결 안 될 때

### 증상
- 프로세스 탭이 비어 있음 · Gate 프로그레스 없음 · beacon 저장 실패

### 확인 순서
1. 프로젝트 루트에 `.beacon/project.json` 존재 여부
2. `BEACON_PROJECT_ROOT` (없으면 cwd 사용)
3. `GET /api/beacon/available` · `/api/health` 응답
4. Docker/서버리스 환경에서는 FS 쓰기 제한이 있을 수 있음 → 로컬 `npm run dev` 로 검증
5. WAL/`beacon.db` 권한 문제 시 [BEACON.md](./BEACON.md) 참고

### 우회
- 저장 모드를 `local` 또는 `cloud` 로 두고, Beacon은 읽기만 사용

---

## PWA 설치가 안 될 때

### 증상
- 「홈 화면에 추가」 배너가 없거나 설치 버튼이 동작하지 않음

### 확인 순서
1. **HTTPS** 또는 `localhost` 인지 (PWA 요구사항)
2. `public/manifest.json` · 서비스워커가 빌드에 포함됐는지 (`npm run build && npm start`)
3. 이미 설치돼 있으면 배너가 숨겨질 수 있음
4. 브라우저별: Chrome/Edge 권장 · Safari는 「공유 → 홈 화면에 추가」
5. 이전에 「나중에」를 눌렀다면 사이트 데이터 삭제 후 재시도

### 푸시 알림
- 알림 권한을 **허용**해야 함
- VAPID 키가 없으면 로컬 Notification만 동작할 수 있음 ([env.example](./env.example))

---

## 데이터 복구 방법

### 1) 전체 내보내기 백업이 있는 경우
- 백업 ZIP/Markdown을 보관해 두었다면 해당 파일을 기준으로 수동 복원
- 일지 MD를 Obsidian 가져오기와 유사하게 재수집할 수 있음

### 2) localStorage
1. 같은 브라우저·같은 origin(`http://localhost:3000`)인지 확인
2. 개발자 도구 → Application → Local Storage 에 `folio_*` 키 존재 여부
3. 다른 브라우저/시크릿 창은 **데이터가 다름**

### 3) 런북 백업
```bash
npm run runbook:backup
npm run runbook:restore -- <backup-dir>
```
- `.beacon` 등 파일 복구에 유용 ([INTERNAL.md](./INTERNAL.md))

### 4) 클라우드
- Supabase Dashboard 백업/복원 정책에 따름
- 로그인 계정(user_id)이 같아야 데이터가 보입니다

### 예방
- 주기적으로 **전체 내보내기**
- 중요 문서는 Git/외부 MD로도 보관

---

## 기타 빠른 팁

| 문제 | 조치 |
|------|------|
| 화면이 하얗게 / hydration 오류 | 강력 새로고침 · `npm run dev` 재시작 |
| 검색이 안 열림 | ⌘K / 헤더 돋보기 · 포커스가 input에 있는지 |
| MCP가 UI에 안 보임 | **MCP 가져오기** 클릭 · `.folio-mcp` 경로 확인 |
| Maximum update depth | 최신 `main` 으로 pull (journalPreview 루프 수정 포함) |
| 링크 그래프가 잘려 보임 | 문서 탭 하단까지 스크롤 · 노드 드래그/줌 · 최신 빌드 |

---

## 관련 문서

- [ONBOARDING.md](./ONBOARDING.md)
- [FEATURES.md](./FEATURES.md)
- [GETTING-STARTED.md](./GETTING-STARTED.md)
- [DEPLOY.md](./DEPLOY.md)
- [MCP-GUIDE.md](./MCP-GUIDE.md)
