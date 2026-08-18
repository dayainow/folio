import type { ParsedObsidianNote } from '@/lib/obsidian'
import { createSourceMetadata, provenanceTags, type SourceMetadata, type SourceSystem } from '@/lib/provenance'

export type IntakeSource = 'manual' | 'hermes'
export type IntakeNoteType = 'log' | 'doc' | 'research' | 'meeting' | 'knowledge'
export type IntakeRoute = 'journal' | 'docs'
export type IntakeReviewState = 'ready' | 'needs_review' | 'duplicate'
export type IntakeChangeState = 'new' | 'changed' | 'unchanged'

export type IntakeCandidate = ParsedObsidianNote & {
  source: IntakeSource
  noteType: IntakeNoteType
  route: IntakeRoute
  resolvedDate: string
  category: string
  fingerprint: string
  warnings: string[]
  duplicate: boolean
  provenance: SourceMetadata
  reviewState: IntakeReviewState
  changeState: IntakeChangeState
}

export type IntakeHistoryItem = {
  fingerprint: string
  fileName: string
  relativePath: string
  title: string
  route: IntakeRoute
  targetId: string
  date?: string
  importedAt: string
  provenance?: SourceMetadata
}

const HISTORY_KEY = 'folio_intake_history_v1'
const NOTE_TYPES = new Set<IntakeNoteType>(['log', 'doc', 'research', 'meeting', 'knowledge'])

function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fingerprintText(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (`00000000${(hash >>> 0).toString(16)}`).slice(-8)
}

function inferSource(note: ParsedObsidianNote): { value: IntakeSource; inferred: boolean } {
  const explicit = note.frontmatter.source?.trim().toLowerCase()
  if (explicit === 'hermes' || explicit === 'manual') return { value: explicit, inferred: false }
  if (/(?:^|\/)Hermes(?:\/|$)/i.test(note.relativePath)) {
    return { value: 'hermes', inferred: true }
  }
  return { value: 'manual', inferred: true }
}

function inferType(note: ParsedObsidianNote): { value: IntakeNoteType; inferred: boolean } {
  const rawType = note.frontmatter.type?.trim().toLowerCase()
  if (rawType === 'journal' || rawType === 'journals') return { value: 'log', inferred: false }
  if (rawType === 'document' || rawType === 'docs') return { value: 'doc', inferred: false }
  const explicit = rawType as IntakeNoteType | undefined
  if (explicit && NOTE_TYPES.has(explicit)) return { value: explicit, inferred: false }

  const path = note.relativePath
  if (/(?:^|\/)(Logs?|Journals?)(?:\/|$)/i.test(path)) return { value: 'log', inferred: true }
  if (/(?:^|\/)Research(?:\/|$)/i.test(path)) return { value: 'research', inferred: true }
  if (/(?:^|\/)Meetings?(?:\/|$)/i.test(path)) return { value: 'meeting', inferred: true }
  if (/(?:^|\/)Knowledge(?:\/|$)/i.test(path)) return { value: 'knowledge', inferred: true }
  if (note.date) return { value: 'log', inferred: true }
  return { value: 'doc', inferred: true }
}

export function categoryForIntakeType(type: IntakeNoteType): string {
  if (type === 'research') return 'Research'
  if (type === 'meeting') return 'Meeting'
  if (type === 'knowledge') return 'Knowledge'
  if (type === 'log') return 'Journal'
  return 'Obsidian Import'
}

export function intakeTags(candidate: Pick<IntakeCandidate, 'source' | 'noteType' | 'tags' | 'fingerprint'>): string[] {
  return Array.from(
    new Set([
      ...candidate.tags.map((tag) => tag.replace(/^#/, '').trim()).filter(Boolean),
      `source:${candidate.source}`,
      `type:${candidate.noteType}`,
      `origin:${candidate.fingerprint}`,
      'imported',
    ]),
  )
}

export function intakeFingerprintsFromTagSets(tagSets: string[][]): string[] {
  return Array.from(
    new Set(
      tagSets
        .flat()
        .filter((tag) => tag.startsWith('origin:'))
        .map((tag) => tag.slice('origin:'.length))
        .filter(Boolean),
    ),
  )
}

export function loadIntakeHistory(): IntakeHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as IntakeHistoryItem[]
    return Array.isArray(parsed) ? parsed.filter((item) => Boolean(item?.fingerprint)) : []
  } catch {
    return []
  }
}

export function saveIntakeHistory(history: IntakeHistoryItem[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 500)))
}

export function appendIntakeHistory(items: IntakeHistoryItem[]): IntakeHistoryItem[] {
  const byFingerprint = new Map(loadIntakeHistory().map((item) => [item.fingerprint, item]))
  for (const item of items) byFingerprint.set(item.fingerprint, item)
  const next = [...byFingerprint.values()].sort((a, b) => b.importedAt.localeCompare(a.importedAt))
  saveIntakeHistory(next)
  return next
}

export function buildIntakeCandidates(
  notes: ParsedObsidianNote[],
  history: IntakeHistoryItem[] = loadIntakeHistory(),
  now = new Date(),
  knownFingerprints: Iterable<string> = [],
  sourceSystem: SourceSystem = 'obsidian',
): IntakeCandidate[] {
  const historyBySourcePath = new Map(
    history
      .filter((item) => item.provenance?.system && (item.provenance.path || item.relativePath))
      .sort((a, b) => a.importedAt.localeCompare(b.importedAt))
      .map((item) => [`${item.provenance!.system}:${item.provenance!.path || item.relativePath}`, item]),
  )
  const seen = new Set([
    ...history.map((item) => item.fingerprint),
    ...knownFingerprints,
  ])
  return notes.map((note) => {
    const source = inferSource(note)
    const noteType = inferType(note)
    const warnings: string[] = []
    if (source.inferred) warnings.push('source를 경로 기준으로 보완')
    if (noteType.inferred) warnings.push('type을 경로 기준으로 보완')
    if (!note.date) warnings.push('created가 없어 오늘 날짜 사용')
    if (note.tags.length === 0) warnings.push('tags 없음')

    const fingerprint = fingerprintText(
      [
        note.title.trim(),
        source.value,
        noteType.value,
        note.date ?? '',
        note.content.trim(),
      ].join('\n'),
    )
    const duplicate = seen.has(fingerprint)
    seen.add(fingerprint)
    const sourcePathKey = `${sourceSystem}:${note.relativePath}`
    const previousAtPath = historyBySourcePath.get(sourcePathKey)
    const changeState: IntakeChangeState = duplicate
      ? 'unchanged'
      : previousAtPath
        ? 'changed'
        : 'new'
    historyBySourcePath.set(sourcePathKey, {
      fingerprint,
      fileName: note.fileName,
      relativePath: note.relativePath,
      title: note.title,
      route: noteType.value === 'log' ? 'journal' : 'docs',
      targetId: '',
      importedAt: now.toISOString(),
      provenance: createSourceMetadata({ system: sourceSystem, fingerprint, path: note.relativePath, now }),
    })

    return {
      ...note,
      source: source.value,
      noteType: noteType.value,
      route: noteType.value === 'log' ? 'journal' : 'docs',
      resolvedDate: note.date ?? localDateKey(now),
      category: categoryForIntakeType(noteType.value),
      fingerprint,
      warnings,
      duplicate,
      provenance: createSourceMetadata({
        system: sourceSystem,
        fingerprint,
        path: note.relativePath,
        now,
      }),
      reviewState: duplicate ? 'duplicate' : warnings.length ? 'needs_review' : 'ready',
      changeState,
    }
  })
}

export function canonicalIntakeTags(candidate: IntakeCandidate): string[] {
  return Array.from(new Set([...intakeTags(candidate), ...provenanceTags(candidate.provenance)]))
}

export function __resetIntakeHistoryForTests(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(HISTORY_KEY)
}
