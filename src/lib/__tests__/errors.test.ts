import { describe, expect, it } from 'vitest'
import { friendlyErrorMessage, toUserErrorMessage } from '@/lib/errors'

describe('friendlyErrorMessage (P55)', () => {
  it('maps network errors', () => {
    expect(friendlyErrorMessage(new Error('Failed to fetch'))).toMatch(/네트워크/)
    expect(toUserErrorMessage(new Error('network timeout'))).toMatch(/네트워크|시간/)
  })

  it('maps auth and permission', () => {
    expect(friendlyErrorMessage(new Error('401 unauthorized'))).toMatch(/로그인|세션/)
    expect(friendlyErrorMessage(new Error('403 Forbidden'))).toMatch(/권한/)
  })

  it('maps not found, quota, csrf', () => {
    expect(friendlyErrorMessage(new Error('404 not found'))).toMatch(/찾을 수/)
    expect(friendlyErrorMessage(new Error('QuotaExceededError localStorage'))).toMatch(/저장 공간/)
    expect(friendlyErrorMessage(new Error('csrf token invalid'))).toMatch(/보안|새로고침/)
  })

  it('falls back for unknown errors', () => {
    expect(friendlyErrorMessage(new Error('weird-xyz'))).toBeNull()
    expect(toUserErrorMessage(new Error('weird-xyz'), '다시 시도')).toBe('다시 시도')
    expect(toUserErrorMessage(new Error('weird-xyz'))).toMatch(/일시적인 오류|weird-xyz/)
  })

  it('accepts string errors', () => {
    expect(friendlyErrorMessage('ECONNREFUSED')).toMatch(/네트워크/)
  })
})
