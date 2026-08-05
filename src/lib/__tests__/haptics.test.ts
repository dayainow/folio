import { describe, expect, it, vi, beforeEach } from 'vitest'
import { haptic, isEdgeSwipeStart } from '@/lib/haptics'

describe('haptics (P57)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('isEdgeSwipeStart detects left edge', () => {
    expect(isEdgeSwipeStart(10, 28)).toBe(true)
    expect(isEdgeSwipeStart(80, 28)).toBe(false)
  })

  it('haptic calls vibrate when available', () => {
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrate,
    })
    haptic(10)
    expect(vibrate).toHaveBeenCalledWith(10)
  })
})
