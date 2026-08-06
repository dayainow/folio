import { describe, expect, it } from 'vitest'
import { cleanAndParseJson, resolveAiProvider, resolveAiModel } from '@/lib/ai-llm'
import { localEmbed, cosineSimilarity, semanticSearchLocal } from '@/lib/ai-semantic'
import { runAiComplete } from '@/lib/ai-complete'
import { runAiEdit } from '@/lib/ai-edit'
import { runAiAnalytics } from '@/lib/ai-analytics'

describe('ai-llm (P67)', () => {
  it('parses fenced json', () => {
    const data = cleanAndParseJson('```json\n{"a":1}\n```')
    expect(data.a).toBe(1)
  })

  it('resolves provider null without keys', () => {
    const prev = process.env.OPENAI_API_KEY
    const prev2 = process.env.ANTHROPIC_API_KEY
    const prev3 = process.env.GEMINI_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GEMINI_API_KEY
    expect(resolveAiProvider('auto')).toBeNull()
    if (prev) process.env.OPENAI_API_KEY = prev
    if (prev2) process.env.ANTHROPIC_API_KEY = prev2
    if (prev3) process.env.GEMINI_API_KEY = prev3
  })

  it('maps model aliases', () => {
    expect(resolveAiModel('openai', 'gpt-4')).toBe('gpt-4')
    expect(resolveAiModel('gemini')).toMatch(/gemini/)
  })
})

describe('ai-semantic (P67)', () => {
  it('embeds and ranks related docs', () => {
    const a = localEmbed('배포 파이프라인 장애 핫픽스')
    const b = localEmbed('배포 실패와 핫픽스 롤백')
    const c = localEmbed('점심 메뉴 추천')
    expect(cosineSimilarity(a, b)).toBeGreaterThan(cosineSimilarity(a, c))

    const hits = semanticSearchLocal('배포 장애', [
      { id: '1', source: 'doc', title: 'Deploy', text: '배포 파이프라인 장애 핫픽스' },
      { id: '2', source: 'journal', title: '2026-08-01', text: '점심 메뉴' },
    ])
    expect(hits[0]?.id).toBe('1')
  })
})

describe('ai-complete / edit / analytics local fallback', () => {
  it('suggests tags locally', async () => {
    const res = await runAiComplete({
      task: 'tags',
      text: '배포 파이프라인 folio CI 테스트 배포',
    })
    expect(res.source).toBe('local')
    expect((res.tags?.length ?? 0) + (res.keywords?.length ?? 0)).toBeGreaterThan(0)
  })

  it('edits summarize locally', async () => {
    const res = await runAiEdit({
      action: 'summarize',
      selection: '첫 줄입니다.\n둘째 줄',
    })
    expect(res.source).toBe('local')
    expect(res.result).toContain('첫 줄')
  })

  it('analyzes sentiment locally', async () => {
    const res = await runAiAnalytics({
      journals: [{ date: '2026-08-07', content: '완료하고 성공했다', tags: ['ship'] }],
      tasks: [{ title: 'Done task', status: 'done', tags: ['ship'] }],
    })
    expect(res.source).toBe('local')
    expect(res.projectSummary.length).toBeGreaterThan(0)
  })
})
