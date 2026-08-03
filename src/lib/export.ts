/**
 * P32 — Journal / Docs / Board 브라우저 다운로드 (MD · CSV · JSON · ZIP)
 */
import JSZip from 'jszip'
import type { JournalEntry } from '@/lib/journal'
import type { DocEntry } from '@/lib/docs'
import type { Task } from '@/lib/board'

export type ProgressFn = (ratio: number, label?: string) => void

/** Blob 다운로드 트리거 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  downloadBlob(new Blob([text], { type: mime }), filename)
}

/** 파일명에 쓸 수 없는 문자 제거 */
export function safeFilename(name: string, fallback = 'untitled'): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
  return cleaned || fallback
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 날짜 범위 내 일지 (날짜 오름차순) */
export function filterJournalsByRange(
  journals: Record<string, JournalEntry>,
  from: string,
  to: string,
): JournalEntry[] {
  const a = from <= to ? from : to
  const b = from <= to ? to : from
  return Object.values(journals)
    .filter((e) => e.date >= a && e.date <= b)
    .sort((x, y) => x.date.localeCompare(y.date))
}

/** 일지 → Markdown */
export function journalsToMarkdown(entries: JournalEntry[]): string {
  if (entries.length === 0) {
    return '# Journals\n\n_(선택한 기간에 일지가 없습니다)_\n'
  }
  const from = entries[0]!.date
  const to = entries[entries.length - 1]!.date
  const parts: string[] = [
    `# Journals`,
    ``,
    `기간: ${from} ~ ${to}`,
    `건수: ${entries.length}`,
    `내보낸 시각: ${new Date().toISOString()}`,
    ``,
    `---`,
    ``,
  ]
  for (const e of entries) {
    const tags =
      e.tags?.length > 0 ? e.tags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ') : '_(없음)_'
    parts.push(`## ${e.date}`, ``, `Tags: ${tags}`, ``, e.content?.trim() || '_(빈 일지)_', ``, `---`, ``)
  }
  return parts.join('\n')
}

export function journalsFilename(from: string, to: string): string {
  return `journals-${from}-to-${to}.md`
}

/** 단일 문서 → Markdown (YAML front matter) */
export function docToMarkdown(doc: DocEntry): string {
  const fm = [
    '---',
    `title: ${JSON.stringify(doc.title)}`,
    `category: ${JSON.stringify(doc.category)}`,
    `id: ${doc.id}`,
    `createdAt: ${doc.createdAt}`,
    `updatedAt: ${doc.updatedAt}`,
    '---',
    '',
  ].join('\n')
  const body = doc.content?.trim() ? doc.content : ''
  const hasTitle = /^#\s+/m.test(body)
  return hasTitle ? `${fm}${body}\n` : `${fm}# ${doc.title}\n\n${body}\n`
}

export function docFilename(doc: DocEntry): string {
  return `${safeFilename(doc.title)}.md`
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** Board → CSV (Excel 호환 BOM) */
export function tasksToCsv(tasks: Task[]): string {
  const header = [
    'id',
    'title',
    'description',
    'status',
    'priority',
    'tags',
    'createdAt',
    'updatedAt',
    'jiraKey',
    'jiraUrl',
    'githubIssueNumber',
    'githubUrl',
  ]
  const lines = [header.join(',')]
  for (const t of tasks) {
    lines.push(
      [
        t.id,
        t.title,
        t.description ?? '',
        t.status,
        t.priority,
        (t.tags ?? []).join('|'),
        t.createdAt,
        t.updatedAt,
        t.jiraKey ?? '',
        t.jiraUrl ?? '',
        t.githubIssueNumber != null ? String(t.githubIssueNumber) : '',
        t.githubUrl ?? '',
      ]
        .map((c) => csvEscape(String(c)))
        .join(','),
    )
  }
  return `\uFEFF${lines.join('\n')}\n`
}

export function tasksToJson(tasks: Task[]): string {
  return `${JSON.stringify({ exportedAt: new Date().toISOString(), count: tasks.length, tasks }, null, 2)}\n`
}

async function yieldTick(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0))
}

/** 문서들 → ZIP (docs/*.md) */
export async function zipDocs(
  docs: DocEntry[],
  onProgress?: ProgressFn,
): Promise<Blob> {
  const zip = new JSZip()
  const folder = zip.folder('docs')
  const total = Math.max(1, docs.length)
  const used = new Set<string>()

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]!
    let name = docFilename(doc)
    if (used.has(name)) {
      name = `${safeFilename(doc.title)}-${doc.id.slice(0, 8)}.md`
    }
    used.add(name)
    folder?.file(name, docToMarkdown(doc))
    onProgress?.((i + 1) / total, `문서 ${i + 1}/${docs.length}`)
    if (i % 8 === 0) await yieldTick()
  }

  onProgress?.(0.95, 'ZIP 생성 중…')
  const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
    onProgress?.(0.95 + (meta.percent / 100) * 0.05, 'ZIP 압축 중…')
  })
  onProgress?.(1, '완료')
  return blob
}

export interface FullExportInput {
  journals: Record<string, JournalEntry>
  docs: DocEntry[]
  tasks: Task[]
  version?: string
}

/** 전체 ZIP: journals/ docs/ boards/ metadata.json */
export async function zipFullExport(
  input: FullExportInput,
  onProgress?: ProgressFn,
): Promise<Blob> {
  const zip = new JSZip()
  const journalEntries = Object.values(input.journals).sort((a, b) => a.date.localeCompare(b.date))
  const totalSteps = journalEntries.length + input.docs.length + 3
  let step = 0
  const tick = (label: string) => {
    step += 1
    onProgress?.(Math.min(0.9, step / totalSteps), label)
  }

  const journalsFolder = zip.folder('journals')
  if (journalEntries.length > 0) {
    const from = journalEntries[0]!.date
    const to = journalEntries[journalEntries.length - 1]!.date
    journalsFolder?.file(journalsFilename(from, to), journalsToMarkdown(journalEntries))
    for (const e of journalEntries) {
      journalsFolder?.file(`${e.date}.md`, journalsToMarkdown([e]))
      tick(`일지 ${e.date}`)
      if (step % 10 === 0) await yieldTick()
    }
  } else {
    journalsFolder?.file('README.md', '# Journals\n\n_(없음)_\n')
    tick('일지 없음')
  }

  const docsFolder = zip.folder('docs')
  const used = new Set<string>()
  for (const doc of input.docs) {
    let name = docFilename(doc)
    if (used.has(name)) name = `${safeFilename(doc.title)}-${doc.id.slice(0, 8)}.md`
    used.add(name)
    docsFolder?.file(name, docToMarkdown(doc))
    tick(`문서 ${doc.title}`)
    if (step % 8 === 0) await yieldTick()
  }
  if (input.docs.length === 0) {
    docsFolder?.file('README.md', '# Docs\n\n_(없음)_\n')
    tick('문서 없음')
  }

  const boardsFolder = zip.folder('boards')
  boardsFolder?.file('tasks.csv', tasksToCsv(input.tasks))
  boardsFolder?.file('tasks.json', tasksToJson(input.tasks))
  tick('보드 CSV/JSON')

  const metadata = {
    exportedAt: new Date().toISOString(),
    version: input.version ?? process.env.npm_package_version ?? '2.4.0-wip',
    counts: {
      journals: journalEntries.length,
      docs: input.docs.length,
      tasks: input.tasks.length,
    },
    structure: ['journals/', 'docs/', 'boards/', 'metadata.json'],
  }
  zip.file('metadata.json', `${JSON.stringify(metadata, null, 2)}\n`)
  tick('metadata')

  onProgress?.(0.95, 'ZIP 생성 중…')
  const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
    onProgress?.(0.95 + (meta.percent / 100) * 0.05, 'ZIP 압축 중…')
  })
  onProgress?.(1, '완료')
  return blob
}

export function fullExportFilename(): string {
  return `folio-export-${todayIso()}.zip`
}
