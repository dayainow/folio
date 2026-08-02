import { beforeEach, describe, expect, it } from 'vitest'
import { getAllTags, loadJournals, saveJournal } from '@/lib/journal'

describe('journal storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and loads journal by date', () => {
    saveJournal('2026-08-03', 'hello world', ['work', 'focus'])
    const all = loadJournals()
    expect(all['2026-08-03']?.content).toBe('hello world')
    expect(all['2026-08-03']?.tags).toEqual(['work', 'focus'])
  })

  it('overwrites same date', () => {
    saveJournal('2026-08-03', 'v1', [])
    saveJournal('2026-08-03', 'v2', ['x'])
    expect(loadJournals()['2026-08-03']?.content).toBe('v2')
  })

  it('getAllTags aggregates unique tags', () => {
    const tags = getAllTags({
      '2026-08-01': { tags: ['alpha', 'beta'] },
      '2026-08-02': { tags: ['beta', 'gamma'] },
    })
    expect(tags).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('getAllTags accepts explicit entries', () => {
    expect(getAllTags({ a: { tags: ['z'] }, b: { tags: ['z', 'y'] } }).sort()).toEqual([
      'y',
      'z',
    ])
  })

  it('date keys are ISO strings', () => {
    saveJournal('2026-07-01', 'july', [])
    expect(Object.keys(loadJournals())).toContain('2026-07-01')
  })
})
