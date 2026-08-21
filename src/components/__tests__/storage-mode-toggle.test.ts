import { describe, expect, it } from 'vitest'
import {
  EXTENSION_STORAGE_MODES,
  PRIMARY_STORAGE_MODES,
  shouldCheckBeaconOnMount,
} from '@/components/storage-mode-toggle'

describe('storage mode information architecture', () => {
  it('keeps everyday storage separate from optional extensions', () => {
    expect(PRIMARY_STORAGE_MODES).toEqual(['local', 'cloud'])
    expect(PRIMARY_STORAGE_MODES).not.toContain('beacon')
    expect(EXTENSION_STORAGE_MODES).toEqual(['beacon'])
  })

  it('checks Beacon on startup only for an existing Beacon storage user', () => {
    expect(shouldCheckBeaconOnMount('local')).toBe(false)
    expect(shouldCheckBeaconOnMount('cloud')).toBe(false)
    expect(shouldCheckBeaconOnMount('beacon')).toBe(true)
  })
})
