import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'
import { diffLines, findReplaceRange } from '@/lib/collab-history'
import { presenceColorFor } from '@/lib/presence'
import { parseMentions } from '@/lib/comments'

describe('Yjs CRDT conflict scenarios', () => {
  it('merges concurrent inserts without data loss', () => {
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    const textA = docA.getText('content')
    const textB = docB.getText('content')
    textA.insert(0, 'Hello')

    const updateA = Y.encodeStateAsUpdate(docA)
    Y.applyUpdate(docB, updateA)
    expect(textB.toString()).toBe('Hello')

    textA.insert(5, ' Alice')
    textB.insert(5, ' Bob')

    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB))

    expect(textA.toString()).toBe(textB.toString())
    expect(textA.toString()).toContain('Alice')
    expect(textA.toString()).toContain('Bob')
    expect(textA.toString().startsWith('Hello')).toBe(true)
  })

  it('applies remote replace range like collab setText', () => {
    const cur = 'The quick fox'
    const next = 'The quick brown fox'
    const range = findReplaceRange(cur, next)
    expect(range).toEqual({ start: 10, deleteLen: 0, insert: 'brown ' })

    const doc = new Y.Doc()
    const ytext = doc.getText('content')
    ytext.insert(0, cur)
    if (range) {
      if (range.deleteLen) ytext.delete(range.start, range.deleteLen)
      if (range.insert) ytext.insert(range.start, range.insert)
    }
    expect(ytext.toString()).toBe(next)
  })

  it('findReplaceRange returns null for identical text', () => {
    expect(findReplaceRange('same', 'same')).toBeNull()
  })

  it('diffLines marks replacements', () => {
    const diff = diffLines('line1\nold\nline3', 'line1\nnew\nline3')
    expect(diff.lines.some((l) => l.type === 'del' && l.text === 'old')).toBe(true)
    expect(diff.lines.some((l) => l.type === 'add' && l.text === 'new')).toBe(true)
  })
})

describe('presence + mentions helpers', () => {
  it('presenceColorFor is stable', () => {
    expect(presenceColorFor('u1')).toBe(presenceColorFor('u1'))
  })

  it('parseMentions extracts handles and emails', () => {
    expect(parseMentions('hi @alice and @bob@ex.com')).toEqual(
      expect.arrayContaining(['alice', 'bob@ex.com']),
    )
  })
})
