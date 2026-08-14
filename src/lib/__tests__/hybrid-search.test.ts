import { describe, expect, it } from 'vitest'
import { mergeHybridSearchHits, searchReason } from '@/lib/hybrid-search'
import { evaluateSearchRanking } from '@/lib/search-evaluation'
import type { UnifiedSearchHit } from '@/lib/search-engine'

function hit(id: string, score: number): UnifiedSearchHit {
  return {
    source: 'docs',
    id,
    title: id,
    preview: '',
    score,
    matched: 'content',
    updatedAt: '2026-08-14T00:00:00.000Z',
  }
}

describe('hybrid search ranking', () => {
  it('deduplicates canonical ids and rewards agreement across channels', () => {
    const merged = mergeHybridSearchHits(
      [hit('a', 100), hit('b', 80)],
      [hit('docs:b', 0.9), hit('c', 0.8)],
    )
    expect(merged.map((item) => item.id)).toEqual(['b', 'a', 'c'])
    expect(merged).toHaveLength(3)
    expect(searchReason(merged[0]!)).toBe('키워드와 의미가 모두 일치')
  })

  it('calculates repeatable Top-5 hit rate and reciprocal rank', () => {
    const report = evaluateSearchRanking(
      [
        { query: 'deploy', expectedIds: ['d1'], description: 'decision' },
        { query: 'meeting', expectedIds: ['d2'], description: 'meeting' },
      ],
      (query) => query === 'deploy' ? ['x', 'd1'] : ['d2'],
    )
    expect(report.hitRateAt5).toBe(1)
    expect(report.meanReciprocalRank).toBe(0.75)
    expect(report.failures).toEqual([])
  })
})
