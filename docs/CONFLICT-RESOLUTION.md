# 충돌 해결 (3-way merge)

P48 — 오프라인·하이브리드 동기화 시 base / local / remote 텍스트 병합.

## 알고리즘

`src/lib/conflict-merge.ts` · `threeWayMerge(base, local, remote)`

1. local === remote → 그대로
2. local === base → remote 채택
3. remote === base → local 채택
4. 양쪽 변경이 다르면 **conflict hunk** + 마커:

```text
<<<<<<< local
...
=======
...
>>>>>>> remote
```

## UI

`ConflictMergeDialog` — Base/Local/Remote 미리보기 · 자동 병합 · 전부 Local/Remote · 수동 편집 후 적용.

## 가이드

| 상황 | 권장 |
|------|------|
| 짧은 오프라인 후 복귀 | 자동 병합 결과가 깨끗하면 적용 |
| 동일 문단을 양쪽에서 수정 | 마커를 확인하고 Local/Remote 선택 또는 수동 합본 |
| Yjs CRDT 세션이 살아 있는 경우 | CRDT가 우선 — 3-way는 스냅샷/내보내기 텍스트에 사용 |

## API

```ts
import { threeWayMerge, resolveConflictMarkers, suggestConflictResolution } from '@/lib/conflict-merge'

const result = threeWayMerge(base, local, remote)
if (!result.ok) {
  const localWins = resolveConflictMarkers(result.merged, 'local')
}
```
