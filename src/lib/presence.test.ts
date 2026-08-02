import { describe, expect, it } from 'vitest'
import { presenceColorFor } from '@/lib/presence'

describe('presenceColorFor', () => {
  it('returns a stable hex color for the same userId', () => {
    const a = presenceColorFor('user-abc')
    const b = presenceColorFor('user-abc')
    expect(a).toBe(b)
    expect(a).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('varies across different userIds', () => {
    const colors = new Set(
      ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'grace'].map(presenceColorFor),
    )
    expect(colors.size).toBeGreaterThan(1)
  })
})
