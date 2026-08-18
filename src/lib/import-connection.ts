import type { IntakeHistoryItem } from '@/lib/intake'
import type { SourceSystem } from '@/lib/provenance'

export type ImportConnectionAttempt = {
  system: SourceSystem
  state: 'ready' | 'error'
  sourceName: string
  attemptedAt: string
  error?: string
}

export type ImportConnectionSummary = {
  state: 'never' | 'ready' | 'error'
  importedCount: number
  lastImportedAt?: string
  lastSourceName?: string
  lastPath?: string
  lastError?: string
}

const STORAGE_KEY = 'folio_import_connections_v1'

export function loadImportConnectionAttempts(): Partial<Record<SourceSystem, ImportConnectionAttempt>> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<Record<SourceSystem, ImportConnectionAttempt>>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function recordImportConnectionAttempt(attempt: ImportConnectionAttempt): ImportConnectionAttempt {
  if (typeof window !== 'undefined') {
    const current = loadImportConnectionAttempts()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, [attempt.system]: attempt }))
  }
  return attempt
}

export function summarizeImportConnection(
  system: SourceSystem,
  history: IntakeHistoryItem[],
  attempt = loadImportConnectionAttempts()[system],
): ImportConnectionSummary {
  const imported = history
    .filter((item) => item.provenance?.system === system)
    .sort((a, b) => b.importedAt.localeCompare(a.importedAt))
  const latest = imported[0]

  if (attempt?.state === 'error' && (!latest || attempt.attemptedAt > latest.importedAt)) {
    return {
      state: 'error',
      importedCount: imported.length,
      lastImportedAt: latest?.importedAt,
      lastSourceName: attempt.sourceName,
      lastPath: latest?.provenance?.path ?? latest?.relativePath,
      lastError: attempt.error,
    }
  }

  if (latest || attempt?.state === 'ready') {
    return {
      state: 'ready',
      importedCount: imported.length,
      lastImportedAt: latest?.importedAt ?? attempt?.attemptedAt,
      lastSourceName: attempt?.sourceName,
      lastPath: latest?.provenance?.path ?? latest?.relativePath,
    }
  }

  return { state: 'never', importedCount: 0 }
}

