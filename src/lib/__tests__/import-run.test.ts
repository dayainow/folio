import { beforeEach, describe, expect, it } from 'vitest'
import {
  appendImportRunHistory,
  createImportRunSummary,
  loadImportRunHistory,
  type ImportRunOutcome,
} from '@/lib/import-run'

describe('import run summary', () => {
  beforeEach(() => localStorage.clear())
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

  it('persists recent runs newest first without duplicating the same completion', () => {
    const older = createImportRunSummary([], 1, 'older.zip', new Date('2026-08-18T09:00:00.000Z'))
    const newer = createImportRunSummary([], 2, 'newer.zip', new Date('2026-08-18T10:00:00.000Z'))
    appendImportRunHistory(older)
    appendImportRunHistory(newer)
    appendImportRunHistory(newer)

    expect(loadImportRunHistory().map((run) => run.sourceName)).toEqual(['newer.zip', 'older.zip'])
  })

  it('ignores malformed persisted history', () => {
    localStorage.setItem('folio_import_runs_v1', '{broken')
    expect(loadImportRunHistory()).toEqual([])
  })
})
