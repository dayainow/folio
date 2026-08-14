import type { UnifiedSearchHit } from '@/lib/search-engine'

export type HybridScoreSignals = {
  keyword?: number
  semantic?: number
  keywordRank?: number
  semanticRank?: number
}

export type HybridSearchHit = UnifiedSearchHit & {
  scoreSignals: HybridScoreSignals
}

function hitKey(hit: Pick<UnifiedSearchHit, 'source' | 'id'>): string {
  return `${hit.source}:${hit.id.replace(/^(journal|docs|board):/, '')}`
}

/** Reciprocal Rank Fusion. 서로 다른 점수 체계를 순위 기반으로 안전하게 결합한다. */
export function mergeHybridSearchHits(
  keywordHits: UnifiedSearchHit[],
  semanticHits: UnifiedSearchHit[],
  limit = 50,
): HybridSearchHit[] {
  const merged = new Map<string, HybridSearchHit>()
  const apply = (hits: UnifiedSearchHit[], channel: 'keyword' | 'semantic') => {
    hits.forEach((hit, index) => {
      const key = hitKey(hit)
      const rank = index + 1
      const previous = merged.get(key)
      const signals: HybridScoreSignals = {
        ...(previous?.scoreSignals ?? {}),
        [channel]: hit.score,
        [`${channel}Rank`]: rank,
      }
      const rrf =
        (signals.keywordRank ? 1 / (60 + signals.keywordRank) : 0) +
        (signals.semanticRank ? 1 / (60 + signals.semanticRank) : 0)
      merged.set(key, {
        ...(previous ?? hit),
        ...hit,
        id: hit.id.replace(/^(journal|docs|board):/, ''),
        score: rrf * 1000,
        scoreSignals: signals,
      })
    })
  }
  apply(keywordHits, 'keyword')
  apply(semanticHits, 'semantic')
  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, limit)
}

export function searchReason(hit: Pick<HybridSearchHit, 'scoreSignals'>): string {
  const { keywordRank, semanticRank } = hit.scoreSignals
  if (keywordRank && semanticRank) return '키워드와 의미가 모두 일치'
  if (keywordRank) return '제목·본문·태그가 일치'
  return '의미가 유사한 맥락'
}
