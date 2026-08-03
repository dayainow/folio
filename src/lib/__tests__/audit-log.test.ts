import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAuditLogs,
  computeStorageObservabilityStats,
  getConsecutiveSaveFailures,
  listAuditLogs,
  noteRemoteSaveOutcome,
  recordAudit,
  setAuditUser,
} from '@/lib/audit-log'
import { checksumData, checksumString } from '@/lib/storage-integrity'
import { computeBackoffMs, withBackoffRetry } from '@/lib/storage-retry'

describe('audit-log', () => {
  beforeEach(() => {
    localStorage.clear()
    setAuditUser('tester@example.com')
  })

  it('records save events and computes success rate', () => {
    recordAudit({
      mode: 'local',
      type: 'journal',
      change: '일지 로컬 저장',
      status: 'success',
      size: 120,
      durationMs: 8,
    })
    recordAudit({
      mode: 'cloud',
      type: 'docs',
      change: '문서 클라우드 폴백',
      status: 'fallback',
      error: 'timeout',
      durationMs: 40,
    })
    const logs = listAuditLogs()
    expect(logs).toHaveLength(2)
    expect(logs[0]?.user).toBe('tester@example.com')

    const stats = computeStorageObservabilityStats()
    expect(stats.total).toBe(2)
    expect(stats.success).toBe(1)
    expect(stats.failure).toBe(1)
    expect(stats.successRate).toBe(50)
    expect(stats.byMode.local.success).toBe(1)
    expect(stats.failureReasons[0]?.reason).toBe('timeout')
  })

  it('tracks consecutive remote failures', () => {
    expect(noteRemoteSaveOutcome(false)).toBe(1)
    expect(noteRemoteSaveOutcome(false)).toBe(2)
    expect(getConsecutiveSaveFailures()).toBe(2)
    expect(noteRemoteSaveOutcome(true)).toBe(0)
    expect(getConsecutiveSaveFailures()).toBe(0)
  })

  it('clears logs', () => {
    recordAudit({
      mode: 'beacon',
      type: 'board',
      change: 'x',
      status: 'success',
    })
    clearAuditLogs()
    expect(listAuditLogs()).toHaveLength(0)
  })
})

describe('storage-retry', () => {
  it('computes exponential backoff with cap', () => {
    expect(computeBackoffMs(1, 100, 1000)).toBeGreaterThanOrEqual(100)
    expect(computeBackoffMs(10, 100, 400)).toBeLessThanOrEqual(500)
  })

  it('retries until success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValueOnce('ok')
    const result = await withBackoffRetry((attempt) => fn(attempt), {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 2,
    })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws after exhausting attempts', async () => {
    await expect(
      withBackoffRetry(
        async () => {
          throw new Error('always')
        },
        { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 2 },
      ),
    ).rejects.toThrow('always')
  })
})

describe('storage-integrity checksum', () => {
  it('is stable for same payload', () => {
    const a = checksumData({ b: 2, a: 1 })
    const b = checksumData({ a: 1, b: 2 })
    expect(a).toBe(b)
    expect(checksumString('hello')).toHaveLength(8)
  })
})
