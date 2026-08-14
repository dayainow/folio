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
| 질문 | 하이브리드 검색 근거를 인용하는 개인 비서 답변 · API 키 없으면 로컬 답변 |
| 실행 | 회의 기록에서 후속 작업·기한·담당·우선순위를 제안하고 사용자 승인 후 Backlog에 추가 |
| 분석 | 감정 · 키워드 · 트렌드 · 프로젝트 요약 |

고급 검색은 기본적으로 Lunr 키워드 순위와 로컬 의미 순위를 Reciprocal Rank Fusion으로 결합합니다.
결과마다 키워드/의미 일치 이유와 가져온 원문 시스템·경로를 표시합니다. 체크박스로 하이브리드 검색을 끌 수 있습니다.

검색 품질 회귀는 `src/lib/search-evaluation.ts`의 고정 질문셋으로 Top-5 적중률과 MRR을 비교합니다.

슬래시: `/ai-summary` · `/ai-expand` · `/ai-rewrite` 자리표시.

## API

| 경로 | 용도 |
|------|------|
| `POST /api/ai/summarize` | 기존 워크스페이스 요약 (P36) |
| `POST /api/ai/generate` | `kind: complete \| edit \| analyze \| answer \| actions` |
| `POST /api/ai/semantic` | 의미 검색 / 관련 추천 |

## 모듈

- `src/lib/ai-llm.ts` — 멀티 프로바이더
- `src/lib/ai-complete.ts` · `ai-edit.ts` · `ai-analytics.ts` · `ai-semantic.ts`
- `src/lib/ai-grounded.ts` — 검색 근거 DTO 최소화 · 인용 검증 · 근거 없는 답변 방지
- `src/lib/ai-action-items.ts` — 회의 후속 작업 추출 · 중복 방지 · 승인 후 Task 변환
- `src/components/ai-tools-panel.tsx`
