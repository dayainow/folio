import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetIntakeHistoryForTests,
  appendIntakeHistory,
  buildIntakeCandidates,
  intakeTags,
} from '@/lib/intake'
import type { ParsedObsidianNote } from '@/lib/obsidian'
import { parseMarkdownFile } from '@/lib/obsidian'

function note(input: Partial<ParsedObsidianNote> = {}): ParsedObsidianNote {
  return {
    fileName: '2026-08-14-업무.md',
    relativePath: 'Logs/2026-08-14-업무.md',
    title: '업무',
    date: '2026-08-14',
    content: '오늘 한 일',
    tags: ['folio'],
    frontmatter: { source: 'manual', type: 'log', created: '2026-08-14' },
    ...input,
  }
}

describe('intake pipeline', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetIntakeHistoryForTests()
  })

  it('routes log notes to a new journal entry', () => {
    const candidate = buildIntakeCandidates([note()])[0]!
    expect(candidate.route).toBe('journal')
    expect(candidate.source).toBe('manual')
    expect(candidate.noteType).toBe('log')
    expect(candidate.warnings).toEqual([])
    expect(intakeTags(candidate)).toEqual([
      'folio',
      'source:manual',
      'type:log',
      `origin:${candidate.fingerprint}`,
      'imported',
    ])
  })

  it('infers Hermes research metadata from the source path', () => {
    const candidate = buildIntakeCandidates([
      note({
        relativePath: 'Hermes/Research/시장.md',
        fileName: '시장.md',
        date: null,
        tags: [],
        frontmatter: {},
      }),
    ], [], new Date('2026-08-14T09:00:00+09:00'))[0]!
    expect(candidate.route).toBe('docs')
    expect(candidate.source).toBe('hermes')
    expect(candidate.noteType).toBe('research')
    expect(candidate.category).toBe('Research')
    expect(candidate.resolvedDate).toBe('2026-08-14')
    expect(candidate.warnings).toHaveLength(4)
  })

  it('marks a previously imported original as a duplicate', () => {
    const first = buildIntakeCandidates([note()])[0]!
    appendIntakeHistory([
      {
        fingerprint: first.fingerprint,
        fileName: first.fileName,
        relativePath: first.relativePath,
        title: first.title,
        route: first.route,
        targetId: 'journal-1',
        importedAt: '2026-08-14T00:00:00.000Z',
      },
    ])
    expect(buildIntakeCandidates([note()])[0]?.duplicate).toBe(true)
  })

  it('detects duplicates from origin tags synced with records', () => {
    const first = buildIntakeCandidates([note()])[0]!
    const next = buildIntakeCandidates([note()], [], new Date(), [first.fingerprint])[0]!
    expect(next.duplicate).toBe(true)
  })

  it('reads the canonical heading and quoted frontmatter tags', async () => {
    const parsed = await parseMarkdownFile(new File([
      '---\nsource: hermes\ntype: research\ntags: ["folio", "market"]\n---\n\n# 시장 조사\n\n본문',
    ], '붙여넣기.md', { type: 'text/markdown' }))
    expect(parsed.title).toBe('시장 조사')
    expect(parsed.tags).toEqual(['folio', 'market'])
  })
})
