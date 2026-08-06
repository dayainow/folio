# Folio AI (P67 / v4.1)

자동완성 · 의미 검색 · 편집 · 분석. API 키 없이도 로컬 폴백으로 동작합니다.

## 환경변수

```bash
# 프로바이더 중 하나 이상
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# 선택
FOLIO_AI_PROVIDER=auto          # openai | anthropic | gemini | auto
FOLIO_AI_MODEL=                 # 예: gpt-4, claude-3, gemini-pro, gpt-4o-mini
OPENAI_MODEL_NAME=gpt-4o-mini
ANTHROPIC_MODEL_NAME=claude-3-5-sonnet-20241022
GEMINI_MODEL_NAME=gemini-1.5-flash
```

우선순위(`auto`): OpenAI → Anthropic → Gemini.

## UI

사이드바 **AI** 버튼:

| 탭 | 기능 |
|----|------|
| 작성 | 문장 제안 · 완성 · 태그 · 요약 · 키워드 · 관련 추천 |
| 편집 | 선택 요약/확장/재작성 · 문법 · 번역(ko/en/ja) |
| 의미검색 | 로컬 해시 임베딩 · 관련성 순 |
| 분석 | 감정 · 키워드 · 트렌드 · 프로젝트 요약 |

고급 검색의 **의미 검색** 체크박스로 Lunr + 임베딩 하이브리드.

슬래시: `/ai-summary` · `/ai-expand` · `/ai-rewrite` 자리표시.

## API

| 경로 | 용도 |
|------|------|
| `POST /api/ai/summarize` | 기존 워크스페이스 요약 (P36) |
| `POST /api/ai/generate` | `kind: complete \| edit \| analyze` |
| `POST /api/ai/semantic` | 의미 검색 / 관련 추천 |

## 모듈

- `src/lib/ai-llm.ts` — 멀티 프로바이더
- `src/lib/ai-complete.ts` · `ai-edit.ts` · `ai-analytics.ts` · `ai-semantic.ts`
- `src/components/ai-tools-panel.tsx`
