import { describe, expect, it, vi } from 'vitest'
import {
  escapeHtml,
  sanitizeAttr,
  sanitizeUrl,
  sanitizeUserFacingMessage,
} from '@/lib/sanitize'
import { logError, toUserErrorMessage } from '@/lib/errors'

describe('sanitize', () => {
  it('escapeHtml escapes tags', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    )
  })

  it('sanitizeAttr strips quotes', () => {
    expect(sanitizeAttr('ab"c<d')).toBe('abcd')
  })

  it('sanitizeUrl allows https and relative', () => {
    expect(sanitizeUrl('https://example.com/x')).toContain('https://example.com')
    expect(sanitizeUrl('/guide')).toBe('/guide')
  })

  it('sanitizeUrl blocks javascript', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull()
  })

  it('sanitizeUserFacingMessage from Error', () => {
    expect(sanitizeUserFacingMessage(new Error('  boom  '))).toBe('boom')
  })
})

describe('errors', () => {
  it('toUserErrorMessage uses fallback', () => {
    expect(toUserErrorMessage(null, 'fallback')).toBe('fallback')
  })

  it('logError does not throw', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => logError('test', new Error('x'))).not.toThrow()
    spy.mockRestore()
  })
})
