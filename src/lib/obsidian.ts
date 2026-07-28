/**
 * Obsidian vault 마크다운 가져오기 유틸 (브라우저 File API).
 * Journals/ / Docs/ 하위 .md를 재귀적으로 읽을 때 webkitdirectory 선택과 함께 사용.
 */

export type ObsidianNoteKind = 'journal' | 'docs' | 'any'

export interface ParsedObsidianNote {
  /** 원본 파일명 (확장자 포함) */
  fileName: string
  /** webkitRelativePath 또는 fileName */
  relativePath: string
  title: string
  /** YYYY-MM-DD (추출 실패 시 null) */
  date: string | null
  content: string
  tags: string[]
  frontmatter: Record<string, string>
}

const DATE_PATTERNS = [
  /^(\d{4}-\d{2}-\d{2})/,
  /^(\d{4})_(\d{2})_(\d{2})/,
  /^(\d{4})(\d{2})(\d{2})/,
]

/** YAML frontmatter 파싱 (단순 key: value) */
export function parseFrontmatter(raw: string): {
  frontmatter: Record<string, string>
  body: string
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: raw }

  const frontmatter: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf(':')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    value = value.replace(/^["']|["']$/g, '')
    // tags: [a, b] or tags: a, b
    if (key === 'tags' && value.startsWith('[')) {
      value = value.replace(/^\[|\]$/g, '')
    }
    frontmatter[key] = value
  }

  return { frontmatter, body: match[2] ?? '' }
}

/** 본문/프론트매터의 #태그 / tags 필드를 Folio 태그로 */
export function extractObsidianTags(body: string, frontmatter: Record<string, string> = {}): string[] {
  const tags = new Set<string>()

  const fmTags = frontmatter.tags || frontmatter.tag
  if (fmTags) {
    for (const part of fmTags.split(/[,\s]+/)) {
      const t = part.replace(/^#/, '').trim()
      if (t) tags.add(t)
    }
  }

  // 인라인 #tag (코드블록 단순 무시 없이 — Obsidian 스타일)
  const re = /(?:^|[\s([{])#([A-Za-z0-9가-힣_/-]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    tags.add(m[1])
  }

  return Array.from(tags).sort((a, b) => a.localeCompare(b, 'ko'))
}

function normalizeDate(y: string, mo: string, d: string): string | null {
  const date = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  if (Number.isNaN(Date.parse(date))) return null
  return date
}

/** 파일명에서 날짜 추출 (2024-01-15, 2024_01_15, 20240115 …) */
export function parseDateFromFilename(fileName: string): string | null {
  const base = fileName.replace(/\.md$/i, '')
  for (const re of DATE_PATTERNS) {
    const m = base.match(re)
    if (!m) continue
    if (m[1] && m[1].includes('-')) return m[1]
    if (m.length >= 4) return normalizeDate(m[1], m[2], m[3])
    if (m[1] && m[1].length === 8) {
      return normalizeDate(m[1].slice(0, 4), m[1].slice(4, 6), m[1].slice(6, 8))
    }
  }
  return null
}

/** 프론트매터 date / created 우선, 없으면 파일명 */
export function resolveNoteDate(fileName: string, frontmatter: Record<string, string>): string | null {
  const candidates = [frontmatter.date, frontmatter.created, frontmatter.day]
  for (const c of candidates) {
    if (!c) continue
    const iso = c.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso))) return iso
    const fromName = parseDateFromFilename(`${c}.md`)
    if (fromName) return fromName
  }
  return parseDateFromFilename(fileName)
}

/** 파일명 → 제목 (날짜 prefix 제거) */
export function parseTitleFromFilename(fileName: string): string {
  let base = fileName.replace(/\.md$/i, '')
  base = base.replace(/^\d{4}[-_./]?\d{2}[-_./]?\d{2}[-_\s.]*/, '')
  base = base.replace(/[_-]+/g, ' ').trim()
  return base || fileName.replace(/\.md$/i, '')
}

export function uniqueDocTitle(title: string, existing: Set<string>): string {
  if (!existing.has(title.toLowerCase())) return title
  let n = 2
  while (existing.has(`${title} (${n})`.toLowerCase())) n += 1
  return `${title} (${n})`
}

function relativePathOf(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
}

/** Journals/ Docs/ 경로 필터 (폴더 선택 시). 단일 파일이면 통과 */
export function matchObsidianFolder(relativePath: string, kind: ObsidianNoteKind): boolean {
  if (!relativePath.includes('/')) return true
  const hasJournals = /(?:^|\/)Journals(?:\/|$)/i.test(relativePath)
  const hasDocs = /(?:^|\/)Docs(?:\/|$)/i.test(relativePath)
  if (kind === 'any') return hasJournals || hasDocs || true
  if (kind === 'journal') {
    if (hasJournals) return true
    if (hasDocs) return false
    return true
  }
  // docs
  if (hasDocs) return true
  if (hasJournals) return false
  return true
}

export async function parseMarkdownFile(file: File): Promise<ParsedObsidianNote> {
  const text = await file.text()
  const { frontmatter, body } = parseFrontmatter(text)
  const relativePath = relativePathOf(file)
  const titleFromFm = frontmatter.title || frontmatter.name
  const title = (titleFromFm?.trim() || parseTitleFromFilename(file.name)).trim()
  const date = resolveNoteDate(file.name, frontmatter)
  const tags = extractObsidianTags(body, frontmatter)

  return {
    fileName: file.name,
    relativePath,
    title,
    date,
    content: body.trimStart(),
    tags,
    frontmatter,
  }
}

/** FileList에서 .md만 읽고 kind에 맞는 경로 필터 */
export async function readObsidianMarkdownFiles(
  files: FileList | File[],
  kind: ObsidianNoteKind = 'any',
): Promise<ParsedObsidianNote[]> {
  const list = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.md'))
  const filtered = list.filter(f => matchObsidianFolder(relativePathOf(f), kind))
  const notes: ParsedObsidianNote[] = []
  for (const file of filtered) {
    notes.push(await parseMarkdownFile(file))
  }
  return notes
}
