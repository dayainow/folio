import { describe, expect, it } from 'vitest'
import { createImportRunSummary, type ImportRunOutcome } from '@/lib/import-run'

describe('import run summary', () => {
  it('counts each outcome and identical skipped items', () => {
    const outcomes: ImportRunOutcome[] = [
      { fingerprint: 'new', title: 'New', kind: 'new_document', route: 'docs', targetId: 'doc-new' },
      { fingerprint: 'version', title: 'Changed', kind: 'new_version', route: 'docs', targetId: 'doc-existing' },
      { fingerprint: 'journal', title: 'Log', kind: 'journal', route: 'journal', targetId: 'log-1' },
      { fingerprint: 'failed', title: 'Broken', kind: 'failed', route: 'docs', error: 'save failed' },
    ]

    expect(createImportRunSummary(outcomes, 2, 'workspace.zip', new Date('2026-08-18T10:00:00.000Z'))).toMatchObject({
      completedAt: '2026-08-18T10:00:00.000Z',
      sourceName: 'workspace.zip',
      newDocuments: 1,
      newVersions: 1,
      journals: 1,
      skipped: 2,
      failed: 1,
    })
  })

  it('returns a clean summary when nothing was selected', () => {
    expect(createImportRunSummary([], 3)).toMatchObject({
      newDocuments: 0,
      newVersions: 0,
      journals: 0,
      skipped: 3,
      failed: 0,
      outcomes: [],
    })
  })
})

