export type SourceSystem =
  | 'manual'
  | 'clipboard'
  | 'obsidian'
  | 'notion'
  | 'jira'
  | 'github'
  | 'mcp'
  | 'web'
  | 'file'

export type SyncState = 'local' | 'imported' | 'linked' | 'stale' | 'error'

/**
 * 원문과 Folio 레코드의 관계를 설명하는 공통 계약.
 * AI 인덱스는 이 값을 복사해 사용하되 원본 데이터로 취급하지 않는다.
 */
export interface SourceMetadata {
  system: SourceSystem
  externalId?: string
  path?: string
  url?: string
  fingerprint: string
  importedAt: string
  lastSyncedAt?: string
  syncState: SyncState
}

const SOURCE_LABELS: Record<SourceSystem, string> = {
  manual: '직접 작성',
  clipboard: '붙여넣기',
  obsidian: 'Obsidian',
  notion: 'Notion',
  jira: 'Jira',
  github: 'GitHub',
  mcp: 'MCP',
  web: '웹',
  file: '파일',
}

export function sourceSystemLabel(system: SourceSystem): string {
  return SOURCE_LABELS[system]
}

export function createSourceMetadata(input: {
  system: SourceSystem
  fingerprint: string
  path?: string
  externalId?: string
  url?: string
  now?: Date
}): SourceMetadata {
  const importedAt = (input.now ?? new Date()).toISOString()
  return {
    system: input.system,
    fingerprint: input.fingerprint,
    syncState: input.system === 'manual' || input.system === 'clipboard' ? 'local' : 'imported',
    importedAt,
    ...(input.path ? { path: input.path } : {}),
    ...(input.externalId ? { externalId: input.externalId } : {}),
    ...(input.url ? { url: input.url } : {}),
  }
}

export function provenanceTags(metadata: SourceMetadata): string[] {
  return [
    `source-system:${metadata.system}`,
    `origin:${metadata.fingerprint}`,
    `sync:${metadata.syncState}`,
  ]
}
