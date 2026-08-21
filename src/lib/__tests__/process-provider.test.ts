import { beforeEach, describe, expect, it } from 'vitest'
import {
  getProcessProviderPreference,
  setProcessProviderPreference,
} from '@/lib/process-provider'
import { setStorageMode } from '@/lib/storage'

describe('process provider preference', () => {
  beforeEach(() => localStorage.clear())

  it('uses local by default', () => {
    expect(getProcessProviderPreference()).toBe('local')
  })

  it('keeps compatibility for existing Beacon storage users', () => {
    setStorageMode('beacon')
    expect(getProcessProviderPreference()).toBe('beacon')
  })

  it('persists an explicit provider choice', () => {
    setStorageMode('beacon')
    setProcessProviderPreference('local')
    expect(getProcessProviderPreference()).toBe('local')
  })
})
