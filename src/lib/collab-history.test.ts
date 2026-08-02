import { describe, expect, it } from 'vitest'
import { diffLines, findReplaceRange } from '@/lib/collab-history'

describe('findReplaceRange', () => {
  it('returns null when texts are equal', () => {
    expect(findReplaceRange('hello', 'hello')).toBeNull()
  })

  it('finds middle insertion', () => {
    expect(findReplaceRange('ab', 'aXb')).toEqual({
      start: 1,
      deleteLen: 0,
      insert: 'X',
    })
  })

  it('finds middle deletion', () => {
    expect(findReplaceRange('aXb', 'ab')).toEqual({
      start: 1,
      deleteLen: 1,
      insert: '',
    })
  })

  it('finds full replace', () => {
    expect(findReplaceRange('old', 'new')).toEqual({
      start: 0,
      deleteLen: 3,
      insert: 'new',
    })
  })
})

describe('diffLines', () => {
  it('marks added and deleted lines', () => {
    const diff = diffLines('a\nb\nc', 'a\nB\nc')
    expect(diff.lines.some((l) => l.type === 'del' && l.text === 'b')).toBe(true)
    expect(diff.lines.some((l) => l.type === 'add' && l.text === 'B')).toBe(true)
    expect(diff.lines.filter((l) => l.type === 'same').map((l) => l.text)).toEqual(['a', 'c'])
  })

  it('handles empty before', () => {
    const diff = diffLines('', 'hello')
    expect(diff.lines.some((l) => l.type === 'add' && l.text === 'hello')).toBe(true)
  })
})
