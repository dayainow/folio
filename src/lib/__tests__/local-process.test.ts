import { beforeEach, describe, expect, it } from 'vitest'
import { loadLocalProcess, saveLocalProcess } from '@/lib/local-process'

describe('local process provider', () => {
  beforeEach(() => localStorage.clear())

  it('creates an immediately usable process without Beacon', () => {
    const view = loadLocalProcess()

    expect(view.available).toBe(true)
    expect(view.source).toBe('local')
    expect(view.summary?.stages).toHaveLength(5)
    expect(view.summary?.name).toBe('내 업무 흐름')
  })

  it('persists local gate changes and records a timeline event', () => {
    const view = saveLocalProcess({
      name: '출시 준비',
      gates: { p0: { status: 'ready', state: 'ready' } },
      artifacts: [],
    })
    const reloaded = loadLocalProcess()

    expect(view.summary?.name).toBe('출시 준비')
    expect(reloaded.summary?.stages[0]?.gateStatus).toBe('ready')
    expect(reloaded.timeline[0]?.title).toBe('업무 흐름 업데이트')
  })
})
