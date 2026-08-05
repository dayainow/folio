import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDocSnapshot,
  createManualDocVersion,
  diffWords,
  isImportantDocChange,
  listDocVersions,
  restoreFromVersion,
  snapshotOnSave,
} from '@/lib/doc-versions'
import type { DocEntry } from '@/lib/docs'

const memory = new Map<string, unknown>()

vi.mock('@/lib/local-cache', () => ({
  getLocalJson: <T,>(key: string, fallback: T) =>
    (memory.has(key) ? (memory.get(key) as T) : fallback),
  setLocalJson: (key: string, value: unknown) => {
    memory.set(key, value)
  },
  flushLocalJson: () => {},
}))

function doc(partial?: Partial<DocEntry>): DocEntry {
  return {
    id: 'doc-1',
    title: '스펙',
    content: '# Hello\nworld',
    category: 'API',
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
    ...partial,
  }
}

describe('doc-versions (P59)', () => {
  beforeEach(() => {
    memory.clear()
  })

  it('creates version labels v1.0 then v1.1', () => {
    const a = createDocSnapshot({ doc: doc(), kind: 'checkpoint', skipIfUnchanged: false })
    expect(a?.label).toBe('v1.0')
    const b = createDocSnapshot({
      doc: doc({ content: '# Hello\nworld\nmore' }),
      kind: 'auto',
    })
    expect(b?.label).toBe('v1.1')
    expect(listDocVersions('doc-1')).toHaveLength(2)
  })

  it('skips unchanged auto snapshot', () => {
    createDocSnapshot({ doc: doc(), skipIfUnchanged: false })
    expect(createDocSnapshot({ doc: doc(), kind: 'auto' })).toBeNull()
  })

  it('detects important changes and snapshots on save', () => {
    const prev = doc()
    expect(isImportantDocChange(prev, doc({ title: '새 제목' }))).toBe(true)
    const long = 'x'.repeat(300)
    expect(isImportantDocChange(prev, doc({ content: long }))).toBe(true)
    createDocSnapshot({ doc: prev, kind: 'checkpoint', skipIfUnchanged: false })
    const snap = snapshotOnSave(doc({ content: long }), prev)
    expect(snap?.kind).toBe('important')
  })

  it('manual version with note and restore', () => {
    const v = createManualDocVersion(doc({ content: 'restored' }), '릴리즈 후보')
    expect(v?.note).toBe('릴리즈 후보')
    expect(restoreFromVersion(v!).content).toBe('restored')
  })

  it('diffs words', () => {
    const parts = diffWords('hello world', 'hello folio')
    expect(parts.some((p) => p.type === 'del' && p.text === 'world')).toBe(true)
    expect(parts.some((p) => p.type === 'add' && p.text === 'folio')).toBe(true)
  })
})
