import { describe, expect, it } from 'vitest'
import { progressiveWindow } from '@/lib/progressive-list'

describe('progressiveWindow', () => {
  it('renders only the first batch from a large collection', () => {
    const items = Array.from({ length: 500 }, (_, index) => index)
    const result = progressiveWindow(items, 24)
    expect(result.items).toHaveLength(24)
    expect(result.visibleCount).toBe(24)
    expect(result.remainingCount).toBe(476)
  })

  it('never reports negative remaining counts', () => {
    expect(progressiveWindow(['a', 'b'], 24)).toEqual({
      items: ['a', 'b'],
      visibleCount: 2,
      remainingCount: 0,
    })
  })
})
