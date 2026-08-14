export type SearchEvaluationCase = {
  query: string
  expectedIds: string[]
  description: string
}

export type SearchEvaluationReport = {
  cases: number
  hitRateAt5: number
  meanReciprocalRank: number
  failures: Array<{ query: string; expectedIds: string[]; returnedIds: string[] }>
}

/** 고정 질문셋으로 검색 변경 전후의 Top-5 적중률과 MRR을 비교한다. */
export function evaluateSearchRanking(
  cases: SearchEvaluationCase[],
  search: (query: string) => string[],
): SearchEvaluationReport {
  let hits = 0
  let reciprocalRank = 0
  const failures: SearchEvaluationReport['failures'] = []
  for (const item of cases) {
    const returnedIds = search(item.query)
    const rank = returnedIds.findIndex((id) => item.expectedIds.includes(id))
    if (rank >= 0 && rank < 5) hits += 1
    if (rank >= 0) reciprocalRank += 1 / (rank + 1)
    else failures.push({ query: item.query, expectedIds: item.expectedIds, returnedIds: returnedIds.slice(0, 5) })
  }
  const count = cases.length || 1
  return {
    cases: cases.length,
    hitRateAt5: hits / count,
    meanReciprocalRank: reciprocalRank / count,
    failures,
  }
}

export const SEARCH_EVALUATION_SEED: SearchEvaluationCase[] = [
  { query: '최근 결정한 배포 방식은?', expectedIds: ['eval-deploy-decision'], description: '결정 기록 회수' },
  { query: '다음 주 가장 먼저 해야 할 일', expectedIds: ['eval-next-action'], description: '다음 행동 회수' },
  { query: '회의에서 합의한 API 변경', expectedIds: ['eval-api-meeting'], description: '회의 맥락 회수' },
  { query: '막혔던 문제와 해결 방법', expectedIds: ['eval-blocker'], description: '회고 맥락 회수' },
  { query: 'Notion에서 가져온 제품 계획', expectedIds: ['eval-notion-plan'], description: '외부 출처 회수' },
]
