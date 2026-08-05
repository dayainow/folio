import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getBackupSchedule,
  setBackupSchedule,
  shouldRunScheduledBackup,
} from '@/lib/cloud-backup'

beforeEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

describe('cloud-backup schedule', () => {
  it('defaults to disabled 24h', () => {
    const s = getBackupSchedule()
    expect(s.enabled).toBe(false)
    expect(s.intervalHours).toBe(24)
    expect(s.conflictStrategy).toBe('merge')
  })

  it('persists schedule and evaluates due', () => {
    setBackupSchedule({ enabled: true, intervalHours: 1, lastRunAt: null })
    expect(shouldRunScheduledBackup()).toBe(true)

    const past = new Date(Date.now() - 2 * 3600_000).toISOString()
    setBackupSchedule({ lastRunAt: past })
    expect(shouldRunScheduledBackup()).toBe(true)

    const recent = new Date().toISOString()
    setBackupSchedule({ lastRunAt: recent })
    expect(shouldRunScheduledBackup()).toBe(false)

    setBackupSchedule({ enabled: false })
    expect(shouldRunScheduledBackup()).toBe(false)
  })
})
