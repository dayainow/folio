/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { getStorageMode, setStorageMode, STORAGE_MODE_LABELS } from '@/lib/storage'

describe('storage mode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to local when unset', () => {
    expect(getStorageMode()).toBe('local')
  })

  it('persists valid modes', () => {
    setStorageMode('cloud')
    expect(getStorageMode()).toBe('cloud')
    setStorageMode('beacon')
    expect(getStorageMode()).toBe('beacon')
    setStorageMode('local')
    expect(getStorageMode()).toBe('local')
  })

  it('ignores invalid stored values', () => {
    localStorage.setItem('folio_storage_mode', 'nfs')
    expect(getStorageMode()).toBe('local')
  })

  it('exposes Korean labels', () => {
    expect(STORAGE_MODE_LABELS.local).toBe('로컬')
    expect(STORAGE_MODE_LABELS.cloud).toBe('클라우드')
    expect(STORAGE_MODE_LABELS.beacon).toBe('Beacon')
  })
})
