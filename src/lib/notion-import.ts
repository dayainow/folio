import type { ParsedObsidianNote } from '@/lib/obsidian'
import { extractObsidianTags, parseDateFromFilename, parseFrontmatter } from '@/lib/obsidian'

export type NotionImportResult = {
  notes: ParsedObsidianNote[]
  databases: number
  attachments: number
}

const NOTION_ID_SUFFIX = /\s+[0-9a-f]{32}$/i

export function cleanNotionTitle(value: string): string {
  return value.replace(/\.md$/i, '').replace(NOTION_ID_SUFFIX, '').trim() || '제목 없는 페이지'
}

function noteFromMarkdown(path: string, raw: string): ParsedObsidianNote {
  const fileName = path.split('/').pop() || path
  const { frontmatter, body } = parseFrontmatter(raw)
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const title = frontmatter.title?.trim() || heading || cleanNotionTitle(fileName)
  const created = frontmatter.created || frontmatter.date
  const date = created?.slice(0, 10).match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ?? parseDateFromFilename(fileName)
  return {
    fileName,
    relativePath: `Notion/${path}`,
    title: cleanNotionTitle(title),
    date,
    content: body.trimStart(),
    tags: extractObsidianTags(body, frontmatter),
    frontmatter: { ...frontmatter, source: 'manual', type: frontmatter.type || 'doc' },
  }
}

export function parseCsvRows(raw: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]!
    if (quoted) {
      if (char === '"' && raw[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') quoted = false
      else cell += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''))
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  row.push(cell.replace(/\r$/, ''))
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim()
}

function noteFromCsv(path: string, raw: string): ParsedObsidianNote | null {
  const rows = parseCsvRows(raw)
  if (!rows.length) return null
  const width = Math.max(...rows.map((row) => row.length))
  const headers = Array.from({ length: width }, (_, index) => escapeTableCell(rows[0]?.[index] || `열 ${index + 1}`))
  const bodyRows = rows.slice(1).map((row) =>
    `| ${Array.from({ length: width }, (_, index) => escapeTableCell(row[index] || '')).join(' | ')} |`,
  )
  const title = cleanNotionTitle((path.split('/').pop() || path).replace(/\.csv$/i, ''))
  const content = [
    `# ${title}`,
    '',
    `> Notion 데이터베이스 · ${bodyRows.length}개 행`,
    '',
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...bodyRows,
  ].join('\n')
  return {
    fileName: path.split('/').pop() || path,
    relativePath: `Notion/${path}`,
    title,
    date: parseDateFromFilename(path),
    content,
    tags: ['notion-database'],
    frontmatter: { source: 'manual', type: 'knowledge' },
  }
}

/** Notion의 Markdown & CSV ZIP export에서 Markdown 페이지를 계층 경로와 함께 읽는다. */
export async function readNotionExport(file: File): Promise<NotionImportResult> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const notes: ParsedObsidianNote[] = []
  let databases = 0
  let attachments = 0

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || path.startsWith('__MACOSX/')) continue
    if (path.toLowerCase().endsWith('.md')) {
      notes.push(noteFromMarkdown(path, await entry.async('string')))
    } else if (path.toLowerCase().endsWith('.csv')) {
      const note = noteFromCsv(path, await entry.async('string'))
      if (note) notes.push(note)
      databases += 1
    } else {
      attachments += 1
    }
  }

  return { notes, databases, attachments }
}
