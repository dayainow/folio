import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createProject,
  loadProjects,
  saveProjects,
  toggleProjectLink,
} from '@/lib/projects'

describe('project workspace', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000010')
  })

  afterEach(() => vi.restoreAllMocks())

  it('creates a project with empty resource links', () => {
    const project = createProject({ name: 'Folio 업무 OS', dueDate: '2026-09-30' })
    expect(project.id).toBe('00000000-0000-4000-8000-000000000010')
    expect(project.status).toBe('active')
    expect(project.journalKeys).toEqual([])
    expect(project.docIds).toEqual([])
    expect(project.taskIds).toEqual([])
  })

  it('links and unlinks existing resources without copying them', () => {
    const project = createProject({ name: '연결 테스트' })
    const linked = toggleProjectLink(project, 'journal', 'journal-1')
    expect(linked.journalKeys).toEqual(['journal-1'])
    expect(toggleProjectLink(linked, 'journal', 'journal-1').journalKeys).toEqual([])
  })

  it('persists projects locally', () => {
    const project = createProject({ name: '저장 테스트' })
    saveProjects([project])
    expect(loadProjects()).toEqual([project])
  })
})
