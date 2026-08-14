import { describe, expect, it } from 'vitest'
import { createSourceMetadata, provenanceTags, sourceSystemLabel } from '@/lib/provenance'

describe('source provenance', () => {
  it('creates reproducible metadata for an imported source', () => {
    const metadata = createSourceMetadata({
      system: 'notion',
      fingerprint: 'abc123',
      path: 'Workspace/Plan.md',
      now: new Date('2026-08-14T00:00:00.000Z'),
    })
    expect(metadata).toEqual({
      system: 'notion',
      fingerprint: 'abc123',
      path: 'Workspace/Plan.md',
      importedAt: '2026-08-14T00:00:00.000Z',
      syncState: 'imported',
    })
    expect(provenanceTags(metadata)).toEqual([
      'source-system:notion',
      'origin:abc123',
      'sync:imported',
    ])
    expect(sourceSystemLabel('notion')).toBe('Notion')
  })
})
