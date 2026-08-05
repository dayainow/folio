/**
 * P58 — v4: 일지 트리 메타데이터 필드 보정
 */
import type { Migration } from '@/migrations/types'

export const migration004JournalTreeMeta: Migration = {
  id: 4,
  name: 'journal_tree_meta',
  description: 'folder_id · parent_id · status · projectId · importance 기본값',
  up: (data) => {
    const journals = { ...data.journals }
    for (const [date, entry] of Object.entries(journals)) {
      journals[date] = {
        ...entry,
        date: entry.date || date,
        folder_id: entry.folder_id ?? null,
        parent_id: entry.parent_id ?? null,
        projectId: entry.projectId ?? null,
        importance: entry.importance ?? 3,
        status: entry.status ?? 'published',
      }
    }
    return { ...data, schemaVersion: 4, journals }
  },
  down: (data) => {
    const journals = { ...data.journals }
    for (const [date, entry] of Object.entries(journals)) {
      const {
        folder_id: _f,
        parent_id: _p,
        projectId: _pr,
        importance: _i,
        status: _s,
        ...rest
      } = entry
      journals[date] = rest
    }
    return { ...data, schemaVersion: 3, journals }
  },
}
