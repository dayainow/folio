import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { overallHealth } from '@/lib/health-monitor'
import { setStorageMode } from '@/lib/storage'

describe('overall health optional integrations', () => {
  beforeEach(() => {
    localStorage.clear()
    setStorageMode('local')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ available: false }), { status: 200 })),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('does not warn when optional Beacon is absent in local mode', async () => {
    const health = await overallHealth()

    expect(health.storage.mode).toBe('local')
    expect(health.beacon.available).toBe(false)
    expect(health.level).toBe('ok')
    expect(health.badgeLabel).toBe('정상')
    expect(fetch).not.toHaveBeenCalled()
  })
})
