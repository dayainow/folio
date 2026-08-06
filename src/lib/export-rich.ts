/**
 * P60 — HTML / PDF / Markdown(frontmatter) 내보내기
 */
'use client'

import { jsPDF } from 'jspdf'
import type { JournalEntry } from '@/lib/journal'
import type { DocEntry } from '@/lib/docs'
import type { Task } from '@/lib/board'
import { downloadBlob, downloadText, safeFilename, type ProgressFn } from '@/lib/export'

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function yamlQuote(s: string): string {
  return JSON.stringify(s)
}

/** 개선된 MD: YAML frontmatter + 태그/메타 */
export function journalToMarkdownRich(entry: JournalEntry): string {
  const tags = (entry.tags ?? []).map((t) => t.replace(/^#/, ''))
  const fm = [
    '---',
    `type: journal`,
    `date: ${entry.date}`,
    entry.id ? `id: ${entry.id}` : null,
    `tags: [${tags.map(yamlQuote).join(', ')}]`,
    entry.createdAt ? `createdAt: ${entry.createdAt}` : null,
    `updatedAt: ${entry.updatedAt}`,
    `exportedAt: ${new Date().toISOString()}`,
    '---',
    '',
  ]
    .filter(Boolean)
    .join('\n')
  return `${fm}# ${entry.date}\n\n${entry.content?.trim() || ''}\n`
}

export function journalsToMarkdownRich(entries: JournalEntry[]): string {
  if (entries.length === 0) {
    return '---\ntype: journals\ncount: 0\n---\n\n# Journals\n\n_(없음)_\n'
  }
  const from = entries[0]!.date
  const to = entries[entries.length - 1]!.date
  const head = [
    '---',
    `type: journals`,
    `from: ${from}`,
    `to: ${to}`,
    `count: ${entries.length}`,
    `exportedAt: ${new Date().toISOString()}`,
    '---',
    '',
    `# Journals (${from} ~ ${to})`,
    '',
  ].join('\n')
  return head + entries.map((e) => journalToMarkdownRich(e)).join('\n---\n\n')
}

export function docToMarkdownRich(doc: DocEntry, extraTags: string[] = []): string {
  const tags = extraTags.map((t) => t.replace(/^#/, ''))
  const fm = [
    '---',
    `type: doc`,
    `title: ${yamlQuote(doc.title)}`,
    `category: ${yamlQuote(doc.category)}`,
    `id: ${doc.id}`,
    tags.length ? `tags: [${tags.map(yamlQuote).join(', ')}]` : null,
    `createdAt: ${doc.createdAt}`,
    `updatedAt: ${doc.updatedAt}`,
    `exportedAt: ${new Date().toISOString()}`,
    '---',
    '',
  ]
    .filter(Boolean)
    .join('\n')
  const body = doc.content?.trim() ? doc.content : ''
  const hasTitle = /^#\s+/m.test(body)
  return hasTitle ? `${fm}${body}\n` : `${fm}# ${doc.title}\n\n${body}\n`
}

export function tasksToMarkdownRich(tasks: Task[]): string {
  const fm = [
    '---',
    `type: board`,
    `count: ${tasks.length}`,
    `exportedAt: ${new Date().toISOString()}`,
    '---',
    '',
    '# Board',
    '',
  ].join('\n')
  const body = tasks
    .map((t) => {
      const tags = (t.tags ?? []).map((x) => `#${x.replace(/^#/, '')}`).join(' ')
      return [
        `## ${t.title}`,
        '',
        `- id: \`${t.id}\``,
        `- status: ${t.status}`,
        `- priority: ${t.priority}`,
        tags ? `- tags: ${tags}` : null,
        `- updated: ${t.updatedAt}`,
        '',
        t.description?.trim() || '_(설명 없음)_',
        '',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n')
  return fm + body
}

function wrapHtmlPage(title: string, bodyInner: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="generator" content="Folio"/>
<title>${escHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 44rem; margin: 2rem auto; padding: 0 1.25rem; color: #0f172a; background: #fff; }
  @media (prefers-color-scheme: dark) { body { color: #e2e8f0; background: #0b1220; } }
  h1,h2,h3 { line-height: 1.25; }
  pre,code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
  pre { overflow: auto; padding: 0.75rem 1rem; border-radius: 0.5rem; background: #f1f5f9; }
  @media (prefers-color-scheme: dark) { pre { background: #1e293b; } }
  .meta { font-size: 0.8rem; opacity: 0.7; margin-bottom: 1.5rem; }
  .tag { display: inline-block; font-size: 0.75rem; padding: 0.1rem 0.45rem; border-radius: 999px; background: #e2e8f0; margin-right: 0.25rem; }
  @media (prefers-color-scheme: dark) { .tag { background: #334155; } }
  hr { border: 0; border-top: 1px solid #e2e8f0; margin: 1.5rem 0; }
  @media (prefers-color-scheme: dark) { hr { border-color: #334155; } }
  .folio-embed body { margin: 0.75rem auto; }
  @page { size: A4; margin: 15mm; }
  @media print {
    body { max-width: none; margin: 0; padding: 0; background: #fff !important; color: #000 !important; }
    .no-print, .folio-print-chrome, nav, header, footer.meta { display: none !important; }
    a { color: inherit; text-decoration: none; }
    pre { break-inside: avoid; }
    h1, h2, h3 { break-after: avoid; }
  }
</style>
</head>
<body>
${bodyInner}
<footer class="meta">Exported from Folio · ${escHtml(new Date().toISOString())}</footer>
</body>
</html>
`
}

function mdLiteToHtml(md: string): string {
  // 최소 변환 (제목/문단/코드/리스트)
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let inCode = false
  let para: string[] = []
  const flushPara = () => {
    if (!para.length) return
    out.push(`<p>${para.join(' ')}</p>`)
    para = []
  }
  for (const line of lines) {
    if (line.startsWith('```')) {
      flushPara()
      inCode = !inCode
      out.push(inCode ? '<pre><code>' : '</code></pre>')
      continue
    }
    if (inCode) {
      out.push(`${escHtml(line)}\n`)
      continue
    }
    if (/^###\s+/.test(line)) {
      flushPara()
      out.push(`<h3>${escHtml(line.replace(/^###\s+/, ''))}</h3>`)
      continue
    }
    if (/^##\s+/.test(line)) {
      flushPara()
      out.push(`<h2>${escHtml(line.replace(/^##\s+/, ''))}</h2>`)
      continue
    }
    if (/^#\s+/.test(line)) {
      flushPara()
      out.push(`<h1>${escHtml(line.replace(/^#\s+/, ''))}</h1>`)
      continue
    }
    if (/^---+$/.test(line.trim())) {
      flushPara()
      out.push('<hr/>')
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      flushPara()
      out.push(`<li>${escHtml(line.replace(/^[-*]\s+/, ''))}</li>`)
      continue
    }
    if (!line.trim()) {
      flushPara()
      continue
    }
    para.push(escHtml(line))
  }
  flushPara()
  return out.join('\n')
}

export function docToHtml(doc: DocEntry): string {
  const tags = `<div class="meta"><span class="tag">${escHtml(doc.category)}</span></div>`
  const body = `${tags}<h1>${escHtml(doc.title)}</h1>\n${mdLiteToHtml(doc.content || '')}`
  return wrapHtmlPage(doc.title, body)
}

export function journalToHtml(entry: JournalEntry): string {
  const tags = (entry.tags ?? [])
    .map((t) => `<span class="tag">#${escHtml(t.replace(/^#/, ''))}</span>`)
    .join(' ')
  const body = `<div class="meta">${tags}</div><h1>${escHtml(entry.date)}</h1>\n${mdLiteToHtml(entry.content || '')}`
  return wrapHtmlPage(`Journal ${entry.date}`, body)
}

export function tasksToHtml(tasks: Task[]): string {
  const items = tasks
    .map(
      (t) =>
        `<article><h2>${escHtml(t.title)}</h2><p class="meta">${escHtml(t.status)} · ${escHtml(t.priority)}</p><p>${escHtml(t.description || '')}</p></article><hr/>`,
    )
    .join('\n')
  return wrapHtmlPage('Board', `<h1>Board</h1>\n${items}`)
}

export function downloadHtml(html: string, filename: string) {
  downloadText(html, filename, 'text/html;charset=utf-8')
}

function pdfFromLines(
  title: string,
  lines: string[],
  onProgress?: ProgressFn,
): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 48
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const maxW = pageW - margin * 2
  let y = margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  const titleLines = doc.splitTextToSize(title, maxW) as string[]
  for (const tl of titleLines) {
    doc.text(tl, margin, y)
    y += 22
  }
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)

  const total = Math.max(1, lines.length)
  for (let i = 0; i < lines.length; i += 1) {
    const wrapped = doc.splitTextToSize(lines[i] || ' ', maxW) as string[]
    for (const w of wrapped) {
      if (y > pageH - margin) {
        doc.addPage()
        y = margin
      }
      doc.text(w, margin, y)
      y += 14
    }
    y += 4
    if (i % 20 === 0) onProgress?.(0.1 + (0.85 * i) / total, `PDF ${i}/${lines.length}`)
  }
  onProgress?.(1, 'PDF 완료')
  return doc.output('blob')
}

export async function exportDocPdf(doc: DocEntry, onProgress?: ProgressFn): Promise<Blob> {
  onProgress?.(0.05, 'PDF 구성…')
  const lines = [
    `Category: ${doc.category}`,
    `Updated: ${doc.updatedAt}`,
    '',
    ...(doc.content || '').split('\n'),
  ]
  return pdfFromLines(doc.title || 'Document', lines, onProgress)
}

export async function exportJournalPdf(
  entry: JournalEntry,
  onProgress?: ProgressFn,
): Promise<Blob> {
  onProgress?.(0.05, 'PDF 구성…')
  const lines = [
    `Tags: ${(entry.tags ?? []).join(', ') || '-'}`,
    `Updated: ${entry.updatedAt}`,
    '',
    ...(entry.content || '').split('\n'),
  ]
  return pdfFromLines(`Journal ${entry.date}`, lines, onProgress)
}

export async function exportBoardPdf(tasks: Task[], onProgress?: ProgressFn): Promise<Blob> {
  onProgress?.(0.05, 'PDF 구성…')
  const lines: string[] = []
  for (const t of tasks) {
    lines.push(`[${t.status}/${t.priority}] ${t.title}`)
    if (t.description) lines.push(t.description)
    lines.push('')
  }
  return pdfFromLines(`Board (${tasks.length})`, lines, onProgress)
}

export function downloadPdf(blob: Blob, name: string) {
  downloadBlob(blob, `${safeFilename(name)}.pdf`)
}
