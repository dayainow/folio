# Folio 고급 검색 (P52)

브라우저 Lunr.js 기반 전문 검색 (서버 Elasticsearch 불필요).

## 쿼리 문법

| 문법 | 예 |
|------|-----|
| AND / OR / NOT | `배포 AND API`, `TODO OR WIP`, `NOT draft` |
| 구문 | `"API 설계"` |
| 필드 | `title:가이드` · `tag:배포` · `content:마이그레이션` |
| 와일드카드 | `API*` |
| 정규식 | `/WIP/i` (후처리 필터) |

## API

- `advancedSearchAll(query, filters)` — `src/lib/search.ts`
- `runAdvancedSearch` / `parseSearchQuery` — `src/lib/search-engine.ts`
- `saveSearch` / `BUILTIN_SEARCH_PRESETS` — `src/lib/saved-searches.ts`
- `downloadSearchHits` / `bulkApplyTags` — `src/lib/search-export.ts`

## UI

헤더 **고급검색** → `AdvancedSearchPanel`
