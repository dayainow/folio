import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  requireAuthUser: vi.fn(),
}))

import { saveDocSupabase } from '@/lib/docs'
import { requireAuthUser } from '@/lib/supabase'

const mockedRequireAuthUser = vi.mocked(requireAuthUser)

describe('document provenance cloud contract', () => {
  beforeEach(() => vi.clearAllMocks())

  it('preserves intake provenance fields in Supabase', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    mockedRequireAuthUser.mockResolvedValue({
      userId: 'user-1',
      supabase: { from: vi.fn(() => ({ upsert })) },
    } as never)

    await saveDocSupabase({
      id: '00000000-0000-4000-8000-000000000020',
      title: '시장 조사',
      content: '원본 내용',
      category: 'Research',
      source: 'hermes',
      noteType: 'research',
      tags: ['folio', 'imported'],
      sourcePath: 'Hermes/Research/시장.md',
      createdAt: '2026-08-14T00:00:00.000Z',
      updatedAt: '2026-08-14T00:00:00.000Z',
    })

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'hermes',
        note_type: 'research',
        tags: ['folio', 'imported'],
        source_path: 'Hermes/Research/시장.md',
      }),
      { onConflict: 'id' },
    )
  })
})
