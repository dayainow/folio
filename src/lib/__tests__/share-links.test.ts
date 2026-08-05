import { describe, expect, it } from 'vitest'
import {
  buildEmbedCode,
  buildShareUrl,
  generateShareToken,
  hashSharePassword,
  isShareExpired,
} from '@/lib/share-links'

describe('share-links', () => {
  it('generates opaque tokens', () => {
    const a = generateShareToken()
    const b = generateShareToken()
    expect(a).toHaveLength(36)
    expect(a).not.toBe(b)
  })

  it('builds share and embed urls', () => {
    expect(buildShareUrl('abc', { origin: 'https://example.com' })).toBe(
      'https://example.com/share/abc',
    )
    expect(buildShareUrl('abc', { origin: 'https://example.com', embed: true })).toBe(
      'https://example.com/share/abc?embed=1',
    )
    const embed = buildEmbedCode('abc', { origin: 'https://example.com', height: 320 })
    expect(embed).toContain('iframe')
    expect(embed).toContain('embed=1')
    expect(embed).toContain('height="320"')
  })

  it('detects expiry', () => {
    expect(isShareExpired({ expiresAt: null })).toBe(false)
    expect(isShareExpired({ expiresAt: '2099-01-01T00:00:00.000Z' })).toBe(false)
    expect(isShareExpired({ expiresAt: '2000-01-01T00:00:00.000Z' })).toBe(true)
  })

  it('hashes passwords stably', async () => {
    const a = await hashSharePassword('secret')
    const b = await hashSharePassword('secret')
    const c = await hashSharePassword('other')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })
})
