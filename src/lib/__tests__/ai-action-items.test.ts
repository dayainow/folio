import { describe, expect, it } from 'vitest'
import { extractActionItems, extractActionItemsLocal, proposalsToTasks } from '@/lib/ai-action-items'

describe('meeting action proposals', () => {
  it('extracts explicit actions, owners, dates and priority locally', () => {
    const proposals = extractActionItemsLocal(
      '- TODO: 배포 체크리스트 정리 담당: 민수 기한: 8/20\n- 긴급 후속: 보안 검토를 내일까지 완료해야 함',
      new Date('2026-08-14T00:00:00.000Z'),
    )
    expect(proposals).toHaveLength(2)
    expect(proposals[0]).toMatchObject({ dueDate: '2026-08-20', assignee: '민수' })
    expect(proposals[1]).toMatchObject({ dueDate: '2026-08-15', priority: 'high' })
  })

  it('uses the local extractor without configured model credentials', async () => {
    const keys = [process.env.OPENAI_API_KEY, process.env.ANTHROPIC_API_KEY, process.env.GEMINI_API_KEY]
    delete process.env.OPENAI_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GEMINI_API_KEY
    try {
      const result = await extractActionItems('ACTION: API 문서를 다음 주까지 갱신하기', new Date('2026-08-14T00:00:00.000Z'))
      expect(result.source).toBe('local')
      expect(result.proposals[0]?.dueDate).toBe('2026-08-21')
    } finally {
      if (keys[0]) process.env.OPENAI_API_KEY = keys[0]
      if (keys[1]) process.env.ANTHROPIC_API_KEY = keys[1]
      if (keys[2]) process.env.GEMINI_API_KEY = keys[2]
    }
  })

  it('creates tasks only after explicit conversion and skips duplicate titles', () => {
    const proposal = extractActionItemsLocal('TODO: API 문서 갱신하기', new Date('2026-08-14T00:00:00.000Z'))[0]!
    expect(proposalsToTasks([proposal], [], new Date('2026-08-14T00:00:00.000Z'))).toMatchObject([
      { title: 'API 문서 갱신하기', status: 'backlog', tags: ['meeting-action', 'assistant-approved'] },
    ])
    expect(proposalsToTasks([proposal], [{
      id: 'existing', title: proposal.title, description: '', status: 'backlog', priority: 'low', tags: [], createdAt: '', updatedAt: '',
    }])).toEqual([])
  })
})
