import { describe, expect, it } from 'vitest'
import {
  docToHtml,
  docToMarkdownRich,
  journalToHtml,
  journalToMarkdownRich,
  tasksToHtml,
  tasksToMarkdownRich,
} from '@/lib/export-rich'
import type { JournalEntry } from '@/lib/journal'
import type { DocEntry } from '@/lib/docs'
import type { Task } from '@/lib/board'

const journal: JournalEntry = {
  date: '2026-08-06',
  content: 'Hello **world**',
  tags: ['#dev', 'folio'],
  updatedAt: '2026-08-06T00:00:00.000Z',
  createdAt: '2026-08-05T00:00:00.000Z',
  id: 'j1',
}

const doc: DocEntry = {
  id: 'd1',
  title: 'Spec',
  category: 'notes',
  content: 'Body line',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-06T00:00:00.000Z',
}

const tasks: Task[] = [
  {
    id: 't1',
    title: 'Ship P60',
    status: 'done',
    priority: 'high',
    description: 'export share',
    tags: ['p60'],
    updatedAt: '2026-08-06T00:00:00.000Z',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
]

describe('export-rich markdown', () => {
  it('includes YAML frontmatter for journal', () => {
    const md = journalToMarkdownRich(journal)
    expect(md.startsWith('---\n')).toBe(true)
    expect(md).toContain('type: journal')
    expect(md).toContain('date: 2026-08-06')
    expect(md).toContain('tags:')
    expect(md).toContain('exportedAt:')
    expect(md).toContain('# 2026-08-06')
  })

  it('includes frontmatter for doc and board', () => {
    expect(docToMarkdownRich(doc, ['docs'])).toContain('type: doc')
    expect(docToMarkdownRich(doc)).toContain('title:')
    expect(tasksToMarkdownRich(tasks)).toContain('type: board')
    expect(tasksToMarkdownRich(tasks)).toContain('Ship P60')
  })
})

describe('export-rich html', () => {
  it('wraps pages for web publish', () => {
    expect(docToHtml(doc)).toContain('<!DOCTYPE html>')
    expect(docToHtml(doc)).toContain('Spec')
    expect(journalToHtml(journal)).toContain('2026-08-06')
    expect(tasksToHtml(tasks)).toContain('Ship P60')
  })
})
