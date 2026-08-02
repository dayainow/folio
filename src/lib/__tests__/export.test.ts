import { describe, expect, it } from 'vitest'
import {
  docToMarkdown,
  filterJournalsByRange,
  journalsToMarkdown,
  safeFilename,
  tasksToCsv,
  tasksToJson,
  zipDocs,
  zipFullExport,
} from '@/lib/export'
import type { JournalEntry } from '@/lib/journal'
import type { DocEntry } from '@/lib/docs'
import type { Task } from '@/lib/board'

describe('safeFilename', () => {
  it('strips illegal characters', () => {
    expect(safeFilename('a/b:c*?.md')).toBe('a-b-c-.md')
  })

  it('falls back when empty', () => {
    expect(safeFilename('   ')).toBe('untitled')
  })
})

describe('filterJournalsByRange', () => {
  const journals: Record<string, JournalEntry> = {
    '2026-01-01': { date: '2026-01-01', content: 'a', tags: [], updatedAt: '' },
    '2026-01-03': { date: '2026-01-03', content: 'c', tags: [], updatedAt: '' },
    '2026-01-05': { date: '2026-01-05', content: 'e', tags: [], updatedAt: '' },
  }

  it('filters inclusive range ascending', () => {
    expect(filterJournalsByRange(journals, '2026-01-02', '2026-01-04').map((r) => r.date)).toEqual([
      '2026-01-03',
    ])
  })

  it('swaps inverted from/to', () => {
    expect(filterJournalsByRange(journals, '2026-01-05', '2026-01-01')).toHaveLength(3)
  })
})

describe('markdown / csv / json', () => {
  it('journalsToMarkdown empty', () => {
    expect(journalsToMarkdown([])).toContain('일지가 없습니다')
  })

  it('journalsToMarkdown with tags', () => {
    const md = journalsToMarkdown([
      { date: '2026-08-03', content: 'hello', tags: ['work'], updatedAt: '' },
    ])
    expect(md).toContain('#work')
  })

  it('docToMarkdown', () => {
    const doc: DocEntry = {
      id: '1',
      title: 'Spec',
      content: 'body',
      category: 'Engineering',
      createdAt: '',
      updatedAt: '',
    }
    expect(docToMarkdown(doc)).toContain('Spec')
  })

  it('tasksToCsv includes BOM and id', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Ship',
        description: 'desc,with,comma',
        status: 'backlog',
        priority: 'medium',
        tags: ['p46'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]
    const csv = tasksToCsv(tasks)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('Ship')
  })

  it('tasksToJson wraps tasks array', () => {
    const parsed = JSON.parse(
      tasksToJson([
        {
          id: 't1',
          title: 'Ship',
          description: '',
          status: 'done',
          priority: 'low',
          tags: [],
          createdAt: '',
          updatedAt: '',
        },
      ]),
    ) as { tasks: Task[] }
    expect(parsed.tasks[0]?.id).toBe('t1')
  })
})

describe('ZIP generation', () => {
  it('zipDocs returns a blob', async () => {
    const blob = await zipDocs([
      {
        id: 'd1',
        title: 'Note',
        content: '# Hi',
        category: 'General',
        createdAt: '',
        updatedAt: '',
      },
    ])
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(10)
  })

  it('zipFullExport includes metadata', async () => {
    const blob = await zipFullExport({
      journals: {},
      docs: [],
      tasks: [],
      version: '2.0.0',
    })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(20)
  })
})
