/**
 * P54 — 마이그레이션 · 병합 · 검증 테스트
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetMigrationStateForTests,
  getCurrentSchemaVersion,
  mergeDatasets,
  persistDataset,
  runMigrationsTo,
  validateDataset,
  type FolioDataset,
} from '@/lib/data-migration'
import { LATEST_SCHEMA_VERSION } from '@/migrations'

function sample(version = 0): FolioDataset {
  return {
    schemaVersion: version,
    journals: {
      '2026-08-01': {
        date: '2026-08-01',
        content: 'hello',
        tags: ['  a ', 'a', '', 'b'],
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    },
    docs: [
      {
        id: 'd1',
        title: '',
        content: 'doc',
        category: '',
        createdAt: '',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    tasks: [
      {
        id: 't1',
        title: 'Task',
        description: '',
        status: 'backlog',
        priority: 'medium',
        tags: ['x', ' x ', 'x'],
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    projects: [],
  }
}

describe('data-migration', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetMigrationStateForTests()
    persistDataset(sample(0))
  })

  it('validates dataset counts and checksum', () => {
    const report = validateDataset(sample(0))
    expect(report.ok).toBe(true)
    expect(report.counts.journals).toBe(1)
    expect(report.counts.docs).toBe(1)
    expect(report.counts.tasks).toBe(1)
    expect(report.counts.projects).toBe(0)
    expect(report.checksum).toMatch(/^[0-9a-f]{8}$/)
  })

  it('runs migrations to latest with tag normalize + timestamps', async () => {
    const r = await runMigrationsTo(LATEST_SCHEMA_VERSION)
    expect(r.ok).toBe(true)
    expect(r.to).toBe(LATEST_SCHEMA_VERSION)
    expect(getCurrentSchemaVersion()).toBe(LATEST_SCHEMA_VERSION)

    const { loadDataset } = await import('@/lib/data-migration')
    const data = loadDataset()
    expect(data.journals['2026-08-01']?.tags).toEqual(['a', 'b'])
    expect(data.tasks[0]?.tags).toEqual(['x'])
    expect(data.docs[0]?.title).toBe('Untitled')
    expect(data.docs[0]?.category).toBe('General')
    expect(data.docs[0]?.createdAt).toBeTruthy()
  })

  it('supports rollback one step', async () => {
    await runMigrationsTo(LATEST_SCHEMA_VERSION)
    const r = await runMigrationsTo(LATEST_SCHEMA_VERSION - 1)
    expect(r.ok).toBe(true)
    expect(getCurrentSchemaVersion()).toBe(LATEST_SCHEMA_VERSION - 1)
  })

  it('merges with conflict strategies', () => {
    const a = sample(1)
    a.projects = [
      {
        id: 'p1',
        name: '기존 프로젝트',
        description: '',
        status: 'active',
        color: 'teal',
        startDate: null,
        dueDate: null,
        journalKeys: [],
        docIds: [],
        taskIds: [],
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ]
    const b: FolioDataset = {
      schemaVersion: 2,
      journals: {
        '2026-08-01': {
          date: '2026-08-01',
          content: 'newer',
          tags: [],
          updatedAt: '2026-08-02T00:00:00.000Z',
        },
        '2026-08-03': {
          date: '2026-08-03',
          content: 'extra',
          tags: [],
          updatedAt: '2026-08-03T00:00:00.000Z',
        },
      },
      docs: [],
      tasks: [],
      projects: [
        {
          ...a.projects[0]!,
          name: '최신 프로젝트',
          updatedAt: '2026-08-02T00:00:00.000Z',
        },
      ],
    }
    const merged = mergeDatasets(a, b, 'merge')
    expect(merged.journals['2026-08-01']?.content).toBe('newer')
    expect(merged.journals['2026-08-03']?.content).toBe('extra')
    expect(merged.projects[0]?.name).toBe('최신 프로젝트')

    const skipped = mergeDatasets(a, b, 'skip')
    expect(skipped.journals['2026-08-01']?.content).toBe('hello')
    expect(skipped.journals['2026-08-03']?.content).toBe('extra')
    expect(skipped.projects[0]?.name).toBe('기존 프로젝트')

    const over = mergeDatasets(a, b, 'overwrite')
    expect(Object.keys(over.journals)).toHaveLength(2)
    expect(over.docs).toHaveLength(0)
  })
})
