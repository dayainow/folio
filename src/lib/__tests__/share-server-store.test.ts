import { describe, expect, it } from 'vitest'
import { getShare, isValidShareToken, putShare, type StoredShare } from '@/lib/share-server-store'

const storedShare = (token: string): StoredShare => ({
  token,
  title: '공유 문서',
  type: 'doc',
  passwordHash: null,
  expiresAt: null,
  createdAt: '2026-08-19T00:00:00.000Z',
  views: 0,
  downloads: 0,
  snapshot: { type: 'doc', title: '공유 문서', html: '<p>내용</p>', markdown: '내용' },
})

describe('share server store token boundary', () => {
  it('accepts opaque URL-safe tokens and rejects path syntax', () => {
    expect(isValidShareToken('0123456789abcdef0123456789abcdef0123')).toBe(true)
    expect(isValidShareToken('../../outside-file')).toBe(false)
    expect(isValidShareToken('0123456789abcde/child')).toBe(false)
    expect(isValidShareToken('0123456789abcde.child')).toBe(false)
  })

  it('refuses invalid tokens before any storage access', async () => {
    await expect(getShare('../../outside-file')).resolves.toBeNull()
    await expect(putShare(storedShare('../../outside-file'))).rejects.toThrow('invalid_share_token')
  })
})
