import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  requireAuthUser: vi.fn(),
}))

import { loadJournalsSupabase, saveJournalSupabase } from '@/lib/journal'
import { requireAuthUser } from '@/lib/supabase'

const mockedRequireAuthUser = vi.mocked(requireAuthUser)

describe('journal cloud multi-entry contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('upserts by user and client key instead of date', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    mockedRequireAuthUser.mockResolvedValue({
      userId: 'user-1',
      supabase: { from: vi.fn(() => ({ upsert })) },
    } as never)

    await saveJournalSupabase('2026-08-14--memo-1', '2026-08-14', '첫 기록', ['daily'])

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        client_key: '2026-08-14--memo-1',
        date: '2026-08-14',
        content: '첫 기록',
      }),
      { onConflict: 'user_id,client_key' },
    )
  })

  it('keeps multiple cloud rows from the same date', async () => {
    const order = vi.fn().mockResolvedValue({
      error: null,
      data: [
        {
          id: 'row-1',
          client_key: '2026-08-14--memo-1',
          date: '2026-08-14',
          content: '첫 기록',
          tags: [],
          created_at: '2026-08-14T09:00:00.000Z',
          updated_at: '2026-08-14T09:00:00.000Z',
        },
        {
          id: 'row-2',
          client_key: '2026-08-14--memo-2',
          date: '2026-08-14',
          content: '두 번째 기록',
          tags: ['decision'],
          created_at: '2026-08-14T10:00:00.000Z',
          updated_at: '2026-08-14T10:00:00.000Z',
        },
      ],
    })
    const eq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq }))
    mockedRequireAuthUser.mockResolvedValue({
      userId: 'user-1',
      supabase: { from: vi.fn(() => ({ select })) },
    } as never)

    const journals = await loadJournalsSupabase()

    expect(Object.keys(journals)).toEqual([
      '2026-08-14--memo-1',
      '2026-08-14--memo-2',
    ])
    expect(journals['2026-08-14--memo-2']?.content).toBe('두 번째 기록')
  })
})
