/**
 * P54 — v3: 타임스탬프·필수 필드 보정
 */
import type { Migration } from '@/migrations/types'

function isoNow() {
  return new Date().toISOString()
}

export const migration003EnsureTimestamps: Migration = {
  id: 3,
  name: 'ensure_timestamps',
  description: 'createdAt/updatedAt 및 필수 문자열 필드 보정',
  up: (data) => {
    const now = isoNow()
    const journals = { ...data.journals }
    for (const [date, entry] of Object.entries(journals)) {
      journals[date] = {
        ...entry,
        date: entry.date || date,
        content: entry.content ?? '',
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        createdAt: entry.createdAt || entry.updatedAt || now,
        updatedAt: entry.updatedAt || now,
      }
    }
    const docs = data.docs.map((d) => ({
      ...d,
      title: d.title || 'Untitled',
      content: d.content ?? '',
      category: d.category || 'General',
      createdAt: d.createdAt || d.updatedAt || now,
      updatedAt: d.updatedAt || now,
    }))
    const tasks = data.tasks.map((t) => ({
      ...t,
      title: t.title || 'Untitled',
      description: t.description ?? '',
      status: t.status || 'backlog',
      priority: t.priority || 'medium',
      tags: Array.isArray(t.tags) ? t.tags : [],
      createdAt: t.createdAt || t.updatedAt || now,
      updatedAt: t.updatedAt || now,
    }))
    return { ...data, schemaVersion: 3, journals, docs, tasks }
  },
  down: (data) => ({
    ...data,
    schemaVersion: 2,
  }),
}
