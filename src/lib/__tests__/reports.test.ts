import { describe, expect, it } from 'vitest'
import { weekRangeOf, monthRangeOf, filterTasks } from '@/lib/export-advanced'
import {
  defaultTemplate,
  resolveTemplateSections,
  type ReportTemplate,
} from '@/lib/reports'
import { buildSectionedPdf } from '@/lib/pdf-layout'
import type { Task } from '@/lib/board'

describe('export-advanced ranges', () => {
  it('weekRangeOf returns Mon–Sun', () => {
    // 2026-08-06 = Thursday
    expect(weekRangeOf('2026-08-06')).toEqual({ from: '2026-08-03', to: '2026-08-09' })
  })

  it('monthRangeOf covers full month', () => {
    expect(monthRangeOf('2026-08-06')).toEqual({ from: '2026-08-01', to: '2026-08-31' })
  })

  it('filterTasks by status', () => {
    const tasks: Task[] = [
      {
        id: '1',
        title: 'a',
        status: 'done',
        priority: 'high',
        description: '',
        tags: [],
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '2',
        title: 'b',
        status: 'backlog',
        priority: 'low',
        description: '',
        tags: ['x'],
        createdAt: '',
        updatedAt: '',
      },
    ]
    expect(filterTasks(tasks, { status: 'done' })).toHaveLength(1)
    expect(filterTasks(tasks, { tag: 'x' })).toHaveLength(1)
  })
})

describe('report templates', () => {
  it('resolveTemplateSections respects include flags', () => {
    const tpl: ReportTemplate = {
      ...defaultTemplate('weekly'),
      include: {
        summary: true,
        journals: true,
        tasks: false,
        gates: true,
        stats: false,
        trends: false,
        achievements: false,
      },
      sections: ['summary', 'journals', 'tasks', 'gates', 'stats', 'trends', 'achievements'],
    }
    expect(resolveTemplateSections(tpl)).toEqual(['summary', 'journals', 'gates'])
  })
})

describe('pdf-layout', () => {
  it('buildSectionedPdf returns a blob', async () => {
    const blob = await buildSectionedPdf(
      'Test',
      [{ heading: 'One', lines: ['hello', 'world'] }],
      { cover: true, toc: true, pageNumbers: true, paper: 'a4', marginMm: 12 },
    )
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(100)
  })
})
