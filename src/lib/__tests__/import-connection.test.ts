import { beforeEach, describe, expect, it } from 'vitest'
import {
  loadImportConnectionAttempts,
  recordImportConnectionAttempt,
  summarizeImportConnection,
} from '@/lib/import-connection'
import type { IntakeHistoryItem } from '@/lib/intake'

const notionHistory: IntakeHistoryItem[] = [
  {
    fingerprint: 'notion-1',
    fileName: 'Roadmap.md',
    relativePath: 'Notion/Planning/Roadmap.md',
    title: 'Roadmap',
    route: 'docs',
    targetId: 'doc-1',
    importedAt: '2026-08-18T09:00:00.000Z',
    provenance: {
      system: 'notion',
      fingerprint: 'notion-1',
      path: 'Notion/Planning/Roadmap.md',
      importedAt: '2026-08-18T09:00:00.000Z',
      syncState: 'imported',
    },
  },
]

describe('import connection status', () => {
  beforeEach(() => localStorage.clear())

  it('starts disconnected when there is no attempt or imported history', () => {
    expect(summarizeImportConnection('notion', [])).toEqual({ state: 'never', importedCount: 0 })
  })

  it('summarizes imported Notion history and the source archive', () => {
    const attempt = recordImportConnectionAttempt({
      system: 'notion',
      state: 'ready',
      sourceName: 'workspace.zip',
      attemptedAt: '2026-08-18T09:00:00.000Z',
    })

    expect(loadImportConnectionAttempts().notion).toEqual(attempt)
    expect(summarizeImportConnection('notion', notionHistory)).toEqual({
      state: 'ready',
      importedCount: 1,
      lastImportedAt: '2026-08-18T09:00:00.000Z',
      lastSourceName: 'workspace.zip',
      lastPath: 'Notion/Planning/Roadmap.md',
    })
  })

  it('surfaces a newer failed attempt without losing the previous import count', () => {
    const attempt = recordImportConnectionAttempt({
      system: 'notion',
      state: 'error',
      sourceName: 'broken.zip',
      attemptedAt: '2026-08-18T10:00:00.000Z',
      error: 'Notion ZIP을 읽지 못했습니다.',
    })

    expect(summarizeImportConnection('notion', notionHistory, attempt)).toMatchObject({
      state: 'error',
      importedCount: 1,
      lastSourceName: 'broken.zip',
      lastPath: 'Notion/Planning/Roadmap.md',
      lastError: 'Notion ZIP을 읽지 못했습니다.',
    })
  })
})
