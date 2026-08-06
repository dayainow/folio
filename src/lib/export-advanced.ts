/**
 * P63 — 고급 PDF/인쇄 내보내기 (일지 기간 · 문서 카테고리 · 보드 필터)
 */
'use client'

import type { JournalEntry } from '@/lib/journal'
import type { DocEntry } from '@/lib/docs'
import type { Task } from '@/lib/board'
import { filterJournalsByRange, type ProgressFn } from '@/lib/export'
import { buildSectionedPdf, type PdfLayoutOptions, type PdfSection } from '@/lib/pdf-layout'
import { downloadPdf, downloadHtml } from '@/lib/export-rich'

export type { PdfLayoutOptions, PaperSize } from '@/lib/pdf-layout'

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 주의 월요일~일요일 (ISO 주, 월 시작) */
export function weekRangeOf(dateStr: string): { from: string; to: string } {
  const d = new Date(`${dateStr}T12:00:00`)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { from: toDateStr(mon), to: toDateStr(sun) }
}

export function monthRangeOf(dateStr: string): { from: string; to: string } {
  const [y, m] = dateStr.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(y!, m!, 0)
  return { from, to: toDateStr(last) }
}

function journalSection(entry: JournalEntry): PdfSection {
  return {
    heading: `Journal ${entry.date}`,
    lines: [
      `Tags: ${(entry.tags ?? []).join(', ') || '-'}`,
      `Updated: ${entry.updatedAt}`,
      '',
      ...(entry.content || '').split('\n'),
    ],
  }
}

function docSection(doc: DocEntry): PdfSection {
  return {
    heading: doc.title || 'Document',
    lines: [
      `Category: ${doc.category}`,
      `Updated: ${doc.updatedAt}`,
      '',
      ...(doc.content || '').split('\n'),
    ],
  }
}

function taskSection(tasks: Task[], title: string): PdfSection {
  const lines: string[] = []
  for (const t of tasks) {
    lines.push(`[${t.status}/${t.priority}] ${t.title}`)
    if (t.description) lines.push(t.description)
    if (t.tags?.length) lines.push(`tags: ${t.tags.join(', ')}`)
    lines.push('')
  }
  return { heading: title, lines: lines.length ? lines : ['(없음)'] }
}

/** 일지 — 단일 날짜 PDF */
export async function exportJournalDayPdf(
  entry: JournalEntry,
  layout: PdfLayoutOptions = {},
  onProgress?: ProgressFn,
): Promise<Blob> {
  return buildSectionedPdf(
    `Journal ${entry.date}`,
    [journalSection(entry)],
    {
      ...layout,
      coverTitle: layout.coverTitle ?? `Journal ${entry.date}`,
      coverSubtitle: layout.coverSubtitle ?? 'Folio daily export',
    },
    onProgress,
  )
}

/** 일지 — 주별 PDF */
export async function exportJournalWeekPdf(
  journals: Record<string, JournalEntry>,
  anchorDate: string,
  layout: PdfLayoutOptions = {},
  onProgress?: ProgressFn,
): Promise<Blob> {
  const { from, to } = weekRangeOf(anchorDate)
  const entries = filterJournalsByRange(journals, from, to).sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  return buildSectionedPdf(
    `Journals ${from} ~ ${to}`,
    entries.length ? entries.map(journalSection) : [{ heading: 'Empty week', lines: ['(일지 없음)'] }],
    {
      ...layout,
      coverTitle: layout.coverTitle ?? `Weekly journals`,
      coverSubtitle: layout.coverSubtitle ?? `${from} ~ ${to}`,
    },
    onProgress,
  )
}

/** 일지 — 월별 PDF */
export async function exportJournalMonthPdf(
  journals: Record<string, JournalEntry>,
  anchorDate: string,
  layout: PdfLayoutOptions = {},
  onProgress?: ProgressFn,
): Promise<Blob> {
  const { from, to } = monthRangeOf(anchorDate)
  const entries = filterJournalsByRange(journals, from, to).sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  const month = from.slice(0, 7)
  return buildSectionedPdf(
    `Journals ${month}`,
    entries.length ? entries.map(journalSection) : [{ heading: 'Empty month', lines: ['(일지 없음)'] }],
    {
      ...layout,
      coverTitle: layout.coverTitle ?? `Monthly journals ${month}`,
      coverSubtitle: layout.coverSubtitle ?? `${from} ~ ${to}`,
    },
    onProgress,
  )
}

/** 문서 — 개별 (레이아웃 옵션) */
export async function exportDocPdfAdvanced(
  doc: DocEntry,
  layout: PdfLayoutOptions = {},
  onProgress?: ProgressFn,
): Promise<Blob> {
  return buildSectionedPdf(doc.title || 'Document', [docSection(doc)], {
    ...layout,
    coverTitle: layout.coverTitle ?? doc.title,
    coverSubtitle: layout.coverSubtitle ?? doc.category,
  }, onProgress)
}

/** 문서 — 카테고리별 PDF */
export async function exportDocsByCategoryPdf(
  docs: DocEntry[],
  category: string,
  layout: PdfLayoutOptions = {},
  onProgress?: ProgressFn,
): Promise<Blob> {
  const list = docs.filter((d) => d.category === category)
  return buildSectionedPdf(
    `Docs · ${category}`,
    list.length ? list.map(docSection) : [{ heading: category, lines: ['(문서 없음)'] }],
    {
      ...layout,
      coverTitle: layout.coverTitle ?? `Category: ${category}`,
      coverSubtitle: layout.coverSubtitle ?? `${list.length} documents`,
    },
    onProgress,
  )
}

export type BoardPdfFilter = {
  status?: Task['status'] | 'all'
  priority?: Task['priority'] | 'all'
  tag?: string
}

export function filterTasks(tasks: Task[], filter: BoardPdfFilter = {}): Task[] {
  return tasks.filter((t) => {
    if (filter.status && filter.status !== 'all' && t.status !== filter.status) return false
    if (filter.priority && filter.priority !== 'all' && t.priority !== filter.priority) return false
    if (filter.tag) {
      const needle = filter.tag.replace(/^#/, '').toLowerCase()
      const tags = (t.tags ?? []).map((x) => x.replace(/^#/, '').toLowerCase())
      if (!tags.includes(needle)) return false
    }
    return true
  })
}

/** 보드 — 전체 또는 필터된 태스크 PDF */
export async function exportBoardPdfAdvanced(
  tasks: Task[],
  filter: BoardPdfFilter = {},
  layout: PdfLayoutOptions = {},
  onProgress?: ProgressFn,
): Promise<Blob> {
  const filtered = filterTasks(tasks, filter)
  const label =
    filter.status && filter.status !== 'all'
      ? `Board · ${filter.status} (${filtered.length})`
      : `Board (${filtered.length})`
  return buildSectionedPdf(
    label,
    [taskSection(filtered, label)],
    {
      ...layout,
      coverTitle: layout.coverTitle ?? label,
      coverSubtitle: layout.coverSubtitle ?? 'Folio kanban export',
    },
    onProgress,
  )
}

/** 인쇄용 HTML + 미리보기 창 */
export function buildPrintableHtml(
  title: string,
  bodyInner: string,
  paper: 'a4' | 'letter' = 'a4',
): string {
  const size = paper === 'letter' ? 'letter' : 'A4'
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<title>${title.replace(/</g, '&lt;')}</title>
<style>
  :root { color-scheme: light; }
  @page { size: ${size}; margin: 15mm; }
  * { box-sizing: border-box; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    line-height: 1.55;
    color: #0f172a;
    background: #fff;
    margin: 0;
    padding: 0;
  }
  .folio-print-chrome { display: flex; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
  .folio-print-chrome button {
    font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 8px;
    border: 1px solid #cbd5e1; background: #fff; cursor: pointer;
  }
  .folio-print-chrome button.primary { background: #0f172a; color: #fff; border-color: #0f172a; }
  .folio-print-body { max-width: 44rem; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
  h1,h2,h3 { line-height: 1.25; page-break-after: avoid; }
  article, section { break-inside: avoid; }
  .meta { font-size: 0.8rem; opacity: 0.7; margin-bottom: 1rem; }
  .no-print { }
  @media print {
    .folio-print-chrome, .no-print { display: none !important; }
    body { background: #fff; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
  <div class="folio-print-chrome no-print">
    <button type="button" class="primary" onclick="window.print()">인쇄</button>
    <button type="button" onclick="window.close()">닫기</button>
    <span class="meta" style="margin:auto 0 auto 8px">${size} · Folio print preview</span>
  </div>
  <div class="folio-print-body">
    ${bodyInner}
  </div>
</body>
</html>`
}

/** 새 창에서 인쇄 미리보기 */
export function openPrintPreview(html: string): void {
  if (typeof window === 'undefined') return
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000')
  if (!w) {
    downloadHtml(html, `folio-print-${new Date().toISOString().slice(0, 10)}.html`)
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}

export { downloadPdf }
