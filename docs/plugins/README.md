# Folio 플러그인 시스템 (P51)

내부 마켓플레이스 · 위젯 · 커스텀 필드 · 샌드박스.

## 빠른 시작

1. 사이드바 **플러그인** 버튼
2. **마켓**에서 설치 · **설치됨**에서 활성/업데이트
3. **필드** 탭에서 사용자 정의 필드 추가
4. 사이드바 **플러그인 위젯** 슬롯에 렌더

## 매니페스트 (`package.json` → `folio`)

```json
{
  "name": "@folio/plugin-example",
  "version": "1.0.0",
  "folio": {
    "id": "example",
    "displayName": "Example",
    "sandbox": "none",
    "contributes": {
      "widgets": ["example-widget"],
      "fields": ["example-field"]
    }
  }
}
```

런타임 매니페스트는 `src/lib/plugin-system.ts`의 `PluginManifest`와
`src/lib/plugin-marketplace.ts` 카탈로그를 따릅니다.

## 예제 플러그인

| ID | 경로 | 설명 |
|----|------|------|
| countdown | [countdown](./countdown.md) | D-day 위젯 · task deadline |
| mood-tracker | [mood-tracker](./mood-tracker.md) | 일지 기분 필드 |
| estimate-points | [estimate-points](./estimate-points.md) | 스토리 포인트 |
| sandbox-echo | [sandbox-echo](./sandbox-echo.md) | Worker 샌드박스 데모 |

소스: `src/plugins/*/package.json`

## 샌드박스

| 모드 | 용도 |
|------|------|
| `none` | 신뢰된 builtin (기본) |
| `worker` | `runInWorkerSandbox` — DOM/네트워크 없음 |
| `iframe` | `createIframeSandboxHost` — UI 격리 골격 |

## API

- `registerPlugin` / `setPluginEnabled` / `unregisterPlugin`
- `installFromMarketplace` / `updatePlugin` / `searchMarketplace`
- `listFieldDefs` / `setFieldValue` / `CustomFieldsPanel`
- `PluginWidgetHost` + `PLUGIN_WIDGET_COMPONENTS`

상세 타입: `src/lib/plugin-system.ts`
