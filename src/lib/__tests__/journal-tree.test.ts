import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildJournalTree,
  clearJournalCustomRefs,
  createFolder,
  deleteFolder,
  journalPath,
  linkJournalToFolder,
  loadJournalTree,
  moveJournalToFolder,
  parseJournalPath,
  renameFolder,
  SYSTEM_FOLDER_IDS,
} from '@/lib/journal-tree'
import type { JournalEntry } from '@/lib/journal'

const memory = new Map<string, unknown>()

vi.mock('@/lib/local-cache', () => ({
  getLocalJson: <T,>(key: string, fallback: T) =>
    (memory.has(key) ? (memory.get(key) as T) : fallback),
  setLocalJson: (key: string, value: unknown) => {
    memory.set(key, value)
  },
  flushLocalJson: () => {},
}))

function entry(date: string, partial?: Partial<JournalEntry>): JournalEntry {
  return {
    date,
    content: `# ${date}\nhello`,
    tags: ['work'],
    updatedAt: '2026-07-31T00:00:00.000Z',
    status: 'published',
    ...partial,
  }
}

describe('journal-tree (P58)', () => {
  beforeEach(() => {
    memory.clear()
  })

  it('creates default system folders', () => {
    const store = loadJournalTree()
    expect(store.folders.map((f) => f.id)).toEqual(
      expect.arrayContaining([
        SYSTEM_FOLDER_IDS.uncategorized,
        SYSTEM_FOLDER_IDS.byDate,
        SYSTEM_FOLDER_IDS.byProject,
        SYSTEM_FOLDER_IDS.byTag,
      ]),
    )
  })

  it('CRUD custom folder and move journal', () => {
    const folder = createFolder('프로젝트 A')
    expect(folder.kind).toBe('custom')
    moveJournalToFolder('2026-07-31', folder.id)
    const store = loadJournalTree()
    expect(store.refs.some((r) => r.journalDate === '2026-07-31' && r.folderId === folder.id)).toBe(
      true,
    )
    renameFolder(folder.id, '프로젝트 B')
    expect(loadJournalTree().folders.find((f) => f.id === folder.id)?.name).toBe('프로젝트 B')
    deleteFolder(folder.id)
    expect(loadJournalTree().folders.find((f) => f.id === folder.id)).toBeUndefined()
  })

  it('allows symbolic multi-folder refs', () => {
    const a = createFolder('A')
    const b = createFolder('B')
    moveJournalToFolder('2026-07-31', a.id)
    linkJournalToFolder('2026-07-31', b.id)
    const refs = loadJournalTree().refs.filter((r) => r.journalDate === '2026-07-31')
    expect(refs).toHaveLength(2)
    clearJournalCustomRefs('2026-07-31')
    expect(loadJournalTree().refs.filter((r) => r.journalDate === '2026-07-31')).toHaveLength(0)
  })

  it('builds tree with virtual date groups', () => {
    const journals = {
      '2026-07-31': entry('2026-07-31'),
      '2026-07-01': entry('2026-07-01', { tags: [] }),
      '2026-06-15': entry('2026-06-15', { projectId: 'folio' }),
    }
    const tree = buildJournalTree({ journals })
    expect(tree.find((n) => n.id === SYSTEM_FOLDER_IDS.byDate)?.children.some((c) => c.label === '2026-07')).toBe(
      true,
    )
    expect(tree.find((n) => n.id === SYSTEM_FOLDER_IDS.byProject)?.count).toBeGreaterThan(0)
  })

  it('parses journal path', () => {
    expect(journalPath('folder1', '2026-07-31')).toBe('/journal/folder1/2026-07-31')
    expect(parseJournalPath(['folder1', '2026-07-31'])).toEqual({
      folderSlug: 'folder1',
      date: '2026-07-31',
    })
  })
})
