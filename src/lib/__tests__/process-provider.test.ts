import { beforeEach, describe, expect, it } from 'vitest'
import {
  getProcessProviderPreference,
  setProcessProviderPreference,
} from '@/lib/process-provider'
import { setStorageMode } from '@/lib/storage'
import { loadLocalProcess, saveLocalProcess } from '@/lib/local-process'

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

  it('keeps local process data intact while switching providers', () => {
    saveLocalProcess({
      name: '보존할 로컬 업무',
      gates: { p0: { status: 'ready', state: 'ready' } },
      artifacts: [],
    })

    setProcessProviderPreference('beacon')
    setProcessProviderPreference('local')

    const local = loadLocalProcess()
    expect(local.summary?.name).toBe('보존할 로컬 업무')
    expect(local.summary?.stages[0]?.gateStatus).toBe('ready')
  })
})
