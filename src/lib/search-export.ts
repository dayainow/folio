/**
 * P52 — 검색 결과 내보내기 · 일괄 태그 헬퍼
 */
'use client'

import { downloadText } from '@/lib/export'
import type { UnifiedSearchHit } from '@/lib/search-engine'
import { loadTasks, saveTasks, type Task } from '@/lib/board'
import { loadJournals, saveJournal } from '@/lib/journal'
import { loadDocs, saveDoc } from '@/lib/docs'

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export function searchHitsToCsv(hits: UnifiedSearchHit[]): string {
  const header = ['source', 'id', 'title', 'preview', 'score', 'tags', 'status', 'priority', 'updatedAt']
  const rows = hits.map((h) =>
    [
      h.source,
      h.id,
      h.title,
      h.preview,
      String(Math.round(h.score * 100) / 100),
      (h.tags ?? []).join('|'),
      h.status ?? '',
      h.priority ?? '',
      h.updatedAt,
    ]
      .map((c) => csvEscape(String(c)))
      .join(','),
  )
  return `\uFEFF${[header.join(','), ...rows].join('\n')}`
}

export function searchHitsToJson(hits: UnifiedSearchHit[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: hits.length,
      hits,
    },
    null,
    2,
  )
}

export function downloadSearchHits(
  hits: UnifiedSearchHit[],
  format: 'csv' | 'json',
): void {
  const stamp = new Date().toISOString().slice(0, 10)
  if (format === 'csv') {
    downloadText(searchHitsToCsv(hits), `folio-search-${stamp}.csv`, 'text/csv;charset=utf-8')
  } else {
    downloadText(searchHitsToJson(hits), `folio-search-${stamp}.json`, 'application/json')
  }
}

export type BulkTagResult = { ok: number; fail: number }

/** 선택 결과에 태그 추가/제거 (보드·일지·문서) */
export function bulkApplyTags(
  hits: UnifiedSearchHit[],
  tag: string,
  mode: 'add' | 'remove',
): BulkTagResult {
  const t = tag.trim()
  if (!t) return { ok: 0, fail: 0 }
  let ok = 0
  let fail = 0

  const journalDates = new Set(hits.filter((h) => h.source === 'journal').map((h) => h.id))
  const docIds = new Set(hits.filter((h) => h.source === 'docs').map((h) => h.id))
  const taskIds = new Set(hits.filter((h) => h.source === 'board').map((h) => h.id))

  try {
    if (journalDates.size) {
      const journals = loadJournals()
      for (const date of journalDates) {
        const entry = journals[date]
        if (!entry) {
          fail += 1
          continue
        }
        const tags =
          mode === 'add'
            ? [...new Set([...entry.tags, t])]
            : entry.tags.filter((x) => x !== t)
        saveJournal(date, entry.content, tags)
        ok += 1
      }
    }
  } catch {
    fail += journalDates.size
  }

  try {
    if (docIds.size) {
      const docs = loadDocs()
      for (const id of docIds) {
        const doc = docs.find((d) => d.id === id)
        if (!doc) {
          fail += 1
          continue
        }
        // docs use category as primary; append tag note into category lightly via content marker skip —
        // store tags in category suffix is awkward; use content frontmatter-like line skip.
        // Instead: append to title? Better: no-op for docs without tags field — count as fail soft
        // Folio DocEntry has category only — treat category replace only when mode add and empty
        if (mode === 'add' && !doc.category.includes(t)) {
          saveDoc({ ...doc, category: doc.category ? `${doc.category},${t}` : t, updatedAt: new Date().toISOString() })
          ok += 1
        } else if (mode === 'remove') {
          saveDoc({
            ...doc,
            category: doc.category
              .split(/[,/]/)
              .map((x) => x.trim())
              .filter((x) => x && x !== t)
              .join(','),
            updatedAt: new Date().toISOString(),
          })
          ok += 1
        } else {
          ok += 1
        }
      }
    }
  } catch {
    fail += docIds.size
  }

  try {
    if (taskIds.size) {
      const tasks = loadTasks()
      const next: Task[] = tasks.map((task) => {
        if (!taskIds.has(task.id)) return task
        const tags =
          mode === 'add'
            ? [...new Set([...task.tags, t])]
            : task.tags.filter((x) => x !== t)
        ok += 1
        return { ...task, tags, updatedAt: new Date().toISOString() }
      })
      saveTasks(next)
    }
  } catch {
    fail += taskIds.size
  }

  return { ok, fail }
}
