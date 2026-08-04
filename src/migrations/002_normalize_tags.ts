/**
 * P54 — v2: 태그 정규화 (trim · 중복 제거 · 빈 태그 제거)
 */
import type { Migration } from '@/migrations/types'

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of tags) {
    const s = String(t ?? '').trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

export const migration002NormalizeTags: Migration = {
  id: 2,
  name: 'normalize_tags',
  description: '일지·문서·태스크 태그 trim/중복 제거',
  up: (data) => {
    const journals = { ...data.journals }
    for (const [date, entry] of Object.entries(journals)) {
      journals[date] = { ...entry, tags: normalizeTags(entry.tags) }
    }
    const docs = data.docs.map((d) => ({ ...d, /* docs have no tags */ }))
    const tasks = data.tasks.map((t) => ({
      ...t,
      tags: normalizeTags(t.tags),
    }))
    return { ...data, schemaVersion: 2, journals, docs, tasks }
  },
  down: (data) => ({
    ...data,
    schemaVersion: 1,
  }),
}
