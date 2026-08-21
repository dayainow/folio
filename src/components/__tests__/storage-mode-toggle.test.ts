import { describe, expect, it } from 'vitest'
import {
  EXTENSION_STORAGE_MODES,
  PRIMARY_STORAGE_MODES,
} from '@/components/storage-mode-toggle'

describe('storage mode information architecture', () => {
  it('keeps everyday storage separate from optional extensions', () => {
    expect(PRIMARY_STORAGE_MODES).toEqual(['local', 'cloud'])
    expect(PRIMARY_STORAGE_MODES).not.toContain('beacon')
    expect(EXTENSION_STORAGE_MODES).toEqual(['beacon'])
  })
})
