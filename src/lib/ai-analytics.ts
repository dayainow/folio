/**
 * P67 — AI 분석 (감정 · 키워드 · 트렌드 · 프로젝트 진행)
 */
import { callLlmJson, hasAiCredentials } from '@/lib/ai-llm'

export type SentimentLabel = 'positive' | 'neutral' | 'negative' | 'mixed'

export type AiAnalyticsRequest = {
  journals?: Array<{ date: string; content: string; tags?: string[] }>
  docs?: Array<{ title: string; content: string; category?: string }>
  tasks?: Array<{ title: string; status: string; priority?: string; tags?: string[] }>
  locale?: string
}

export type AiAnalyticsResponse = {
  sentiment: SentimentLabel
  sentimentScore: number
  keywords: string[]
  trends: string[]
  projectSummary: string
  source: 'ai' | 'local'
  provider?: string
  model?: string
}

const POS = ['좋', '완료', '성공', 'happy', 'great', 'done', 'ship', 'win', '감사', '성장']
const NEG = ['문제', '지연', '실패', '막힘', 'bug', 'fail', 'block', '힘들', '불안', '위험', '긴급']

function localAnalytics(req: AiAnalyticsRequest): AiAnalyticsResponse {
  const blob = [
    ...(req.journals ?? []).map((j) => j.content),
    ...(req.docs ?? []).map((d) => `${d.title}\n${d.content}`),
    ...(req.tasks ?? []).map((t) => t.title),
  ]
    .join('\n')
    .toLowerCase()

  let pos = 0
  let neg = 0
  for (const w of POS) if (blob.includes(w)) pos += 1
  for (const w of NEG) if (blob.includes(w)) neg += 1
  const sentimentScore = Math.max(-1, Math.min(1, (pos - neg) / Math.max(1, pos + neg)))
  const sentiment: SentimentLabel =
    pos > 0 && neg > 0 ? 'mixed' : sentimentScore > 0.2 ? 'positive' : sentimentScore < -0.2 ? 'negative' : 'neutral'

  const tagCounts = new Map<string, number>()
  for (const j of req.journals ?? []) {
    for (const t of j.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
  }
  for (const t of req.tasks ?? []) {
    for (const tag of t.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  }
  const keywords = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k]) => k)

  const tasks = req.tasks ?? []
  const done = tasks.filter((t) => t.status === 'done').length
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  const trends: string[] = []
  if (keywords[0]) trends.push(`핵심 키워드 상승: ${keywords.slice(0, 3).join(', ')}`)
  if (tasks.length) trends.push(`보드 진행률 ${progress}% (${done}/${tasks.length})`)
  if ((req.journals ?? []).length) trends.push(`일지 ${(req.journals ?? []).length}건 분석`)

  return {
    sentiment,
    sentimentScore,
    keywords,
    trends,
    projectSummary: `감정 ${sentiment} · 키워드 ${keywords.slice(0, 5).join(', ') || '없음'} · 진행 ${progress}%`,
    source: 'local',
  }
}

export async function runAiAnalytics(req: AiAnalyticsRequest): Promise<AiAnalyticsResponse> {
  if (!hasAiCredentials()) return localAnalytics(req)
  try {
    const prompt = `Analyze Folio workspace data. Locale: ${req.locale ?? 'ko'}.
Journals: ${JSON.stringify((req.journals ?? []).slice(0, 12).map((j) => ({ date: j.date, tags: j.tags, excerpt: j.content.slice(0, 240) })))}
Docs: ${JSON.stringify((req.docs ?? []).slice(0, 10).map((d) => ({ title: d.title, category: d.category, excerpt: d.content.slice(0, 160) })))}
Tasks: ${JSON.stringify((req.tasks ?? []).slice(0, 20).map((t) => ({ title: t.title, status: t.status, priority: t.priority, tags: t.tags })))}

Return JSON:
{
  "sentiment": "positive|neutral|negative|mixed",
  "sentimentScore": 0.0,
  "keywords": ["k1"],
  "trends": ["t1"],
  "projectSummary": "short markdown summary"
}`
    const result = await callLlmJson<{
      sentiment?: string
      sentimentScore?: number
      keywords?: string[]
      trends?: string[]
      projectSummary?: string
    }>(prompt)
    if (!result) return localAnalytics(req)
    const sentiment = (['positive', 'neutral', 'negative', 'mixed'] as const).includes(
      result.data.sentiment as SentimentLabel,
    )
      ? (result.data.sentiment as SentimentLabel)
      : 'neutral'
    return {
      sentiment,
      sentimentScore: typeof result.data.sentimentScore === 'number' ? result.data.sentimentScore : 0,
      keywords: Array.isArray(result.data.keywords) ? result.data.keywords.map(String) : [],
      trends: Array.isArray(result.data.trends) ? result.data.trends.map(String) : [],
      projectSummary:
        typeof result.data.projectSummary === 'string'
          ? result.data.projectSummary
          : '분석 결과를 생성했습니다.',
      source: 'ai',
      provider: result.provider,
      model: result.model,
    }
  } catch (err) {
    console.warn('[AI analytics] fallback local:', err)
    return localAnalytics(req)
  }
}
