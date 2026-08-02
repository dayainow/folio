import { describe, expect, it } from 'vitest'
import {
  docToMarkdown,
  filterJournalsByRange,
  journalsToMarkdown,
  safeFilename,
  tasksToCsv,
  tasksToJson,
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
    const rows = filterJournalsByRange(journals, '2026-01-02', '2026-01-04')
    expect(rows.map((r) => r.date)).toEqual(['2026-01-03'])
  })

  it('swaps inverted from/to', () => {
    const rows = filterJournalsByRange(journals, '2026-01-05', '2026-01-01')
    expect(rows.map((r) => r.date)).toEqual(['2026-01-01', '2026-01-03', '2026-01-05'])
  })
})

describe('journalsToMarkdown', () => {
  it('renders empty period message', () => {
    expect(journalsToMarkdown([])).toContain('일지가 없습니다')
  })

  it('renders entries with tags', () => {
    const md = journalsToMarkdown([
      {
        date: '2026-08-03',
        content: 'hello',
        tags: ['work'],
        updatedAt: '',
      },
    ])
    expect(md).toContain('## 2026-08-03')
    expect(md).toContain('#work')
    expect(md).toContain('hello')
  })
})

describe('docToMarkdown / tasks', () => {
  it('wraps doc as markdown', () => {
    const doc: DocEntry = {
      id: '1',
      title: 'Spec',
      content: '# Title\nbody',
      category: 'Engineering',
      createdAt: '',
      updatedAt: '',
    }
    const md = docToMarkdown(doc)
    expect(md).toContain('Spec')
    expect(md).toContain('body')
  })

  it('exports tasks csv/json', () => {
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
    expect(csv.split('\n')[0]).toContain('id')
    expect(csv).toContain('Ship')
    const parsed = JSON.parse(tasksToJson(tasks)) as { tasks?: Task[] } | Task[]
    const list = Array.isArray(parsed) ? parsed : (parsed.tasks ?? [])
    expect(list[0]?.id).toBe('t1')
  })
})
