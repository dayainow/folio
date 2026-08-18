import type { IntakeRoute } from '@/lib/intake'

export type ImportRunOutcomeKind = 'new_document' | 'new_version' | 'journal' | 'failed'

export type ImportRunOutcome = {
  fingerprint: string
  title: string
  kind: ImportRunOutcomeKind
  route: IntakeRoute
  targetId?: string
  date?: string
  error?: string
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

