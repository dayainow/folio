import type { IntakeCandidate, IntakeRoute } from '@/lib/intake'

export type ImportRunOutcomeKind = 'new_document' | 'new_version' | 'journal' | 'failed'

export type ImportRunOutcome = {
  fingerprint: string
  title: string
  kind: ImportRunOutcomeKind
  route: IntakeRoute
  targetId?: string
  date?: string
  error?: string
  retryCandidate?: IntakeCandidate
  retryMode?: 'version' | 'new'
}

export type ImportRunSummary = {
  completedAt: string
  sourceName?: string
  newDocuments: number
  newVersions: number
  journals: number
  skipped: number
  failed: number
  outcomes: ImportRunOutcome[]
}

const STORAGE_KEY = 'folio_import_runs_v1'
const MAX_RUNS = 20

export function createImportRunSummary(
  outcomes: ImportRunOutcome[],
  skipped: number,
  sourceName?: string,
  now = new Date(),
): ImportRunSummary {
  return {
    completedAt: now.toISOString(),
    sourceName,
    newDocuments: outcomes.filter((outcome) => outcome.kind === 'new_document').length,
    newVersions: outcomes.filter((outcome) => outcome.kind === 'new_version').length,
    journals: outcomes.filter((outcome) => outcome.kind === 'journal').length,
    skipped,
    failed: outcomes.filter((outcome) => outcome.kind === 'failed').length,
    outcomes,
  }
}

export function loadImportRunHistory(): ImportRunSummary[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as ImportRunSummary[]
    return Array.isArray(parsed)
      ? parsed.filter((run) => Boolean(run?.completedAt) && Array.isArray(run.outcomes)).slice(0, MAX_RUNS)
      : []
  } catch {
    return []
  }
}

export function saveImportRunHistory(runs: ImportRunSummary[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(0, MAX_RUNS)))
}

export function appendImportRunHistory(run: ImportRunSummary): ImportRunSummary[] {
  const next = [run, ...loadImportRunHistory().filter((item) => item.completedAt !== run.completedAt)]
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, MAX_RUNS)
  saveImportRunHistory(next)
  return next
}

export function retryCandidateFromOutcome(outcome: ImportRunOutcome): IntakeCandidate | null {
  return outcome.kind === 'failed' && outcome.retryCandidate ? outcome.retryCandidate : null
}
