import { describe, expect, it } from 'vitest'
import { answerWithGrounding, sanitizeGroundingSources } from '@/lib/ai-grounded'

const sources = [
  {
    id: 'doc-1',
    source: 'docs' as const,
    title: '배포 결정',
    excerpt: '금요일 배포 대신 화요일 오전에 점진적으로 배포하기로 결정했다.',
    updatedAt: '2026-08-14T00:00:00.000Z',
  },
]

describe('grounded personal assistant', () => {
  it('answers locally with citations when no provider is configured', async () => {
    const previous = process.env.OPENAI_API_KEY
    const previousAnthropic = process.env.ANTHROPIC_API_KEY
    const previousGemini = process.env.GEMINI_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GEMINI_API_KEY
    try {
      const result = await answerWithGrounding('배포는 언제 하지?', sources)
      expect(result.source).toBe('local')
      expect(result.answer).toContain('[1]')
      expect(result.citations[0]?.title).toBe('배포 결정')
    } finally {
      if (previous) process.env.OPENAI_API_KEY = previous
      if (previousAnthropic) process.env.ANTHROPIC_API_KEY = previousAnthropic
      if (previousGemini) process.env.GEMINI_API_KEY = previousGemini
    }
  })

  it('limits source count and excerpt size before model use', () => {
    const sanitized = sanitizeGroundingSources(Array.from({ length: 12 }, (_, index) => ({
      ...sources[0]!,
      id: String(index),
      excerpt: 'a'.repeat(2000),
    })))
    expect(sanitized).toHaveLength(8)
    expect(sanitized[0]?.excerpt).toHaveLength(1200)
  })

  it('refuses to invent an answer without retrieved evidence', async () => {
    const result = await answerWithGrounding('모르는 질문', [])
    expect(result.confidence).toBe('low')
    expect(result.citations).toEqual([])
    expect(result.answer).toContain('근거')
  })
})
