/**
 * P67 — AI 자동완성 · 태그 · 문장 완성 · 요약 (서버)
 */
import { callLlmJson, callLlmText, hasAiCredentials } from '@/lib/ai-llm'

export type CompleteTask =
  | 'autocomplete'
  | 'tags'
  | 'sentence'
  | 'summarize'
  | 'keywords'

export type AiCompleteRequest = {
  task: CompleteTask
  text: string
  context?: string
  locale?: string
  existingTags?: string[]
}

export type AiCompleteResponse = {
  suggestion: string
  tags?: string[]
  keywords?: string[]
  source: 'ai' | 'local'
  provider?: string
  model?: string
}

function extractKeywordsLocal(text: string, limit = 8): string[] {
  const stop = new Set([
    'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'are', 'was',
    '그', '이', '저', '그리고', '또한', '대한', '있는', '없는', '하는', '해서',
  ])
  const counts = new Map<string, number>()
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}#]+/u)) {
    const t = raw.replace(/^#+/, '')
    if (t.length < 2 || stop.has(t)) continue
    counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k)
}

function localComplete(req: AiCompleteRequest): AiCompleteResponse {
  const text = req.text.trim()
  const keywords = extractKeywordsLocal(`${text}\n${req.context ?? ''}`)
  if (req.task === 'tags') {
    const existing = new Set((req.existingTags ?? []).map((t) => t.replace(/^#/, '').toLowerCase()))
    const tags = keywords.filter((k) => !existing.has(k.toLowerCase())).slice(0, 5)
    return { suggestion: tags.map((t) => `#${t}`).join(' '), tags, keywords, source: 'local' }
  }
  if (req.task === 'summarize') {
    const first = text.split(/\n/).map((l) => l.trim()).filter(Boolean)[0] ?? ''
    return {
      suggestion: first.slice(0, 160) || '요약할 내용이 없습니다.',
      keywords,
      source: 'local',
    }
  }
  if (req.task === 'keywords') {
    return { suggestion: keywords.join(', '), keywords, source: 'local' }
  }
  // autocomplete / sentence
  const lastLine = text.split(/\n/).pop()?.trim() ?? ''
  const hint = keywords[0] ? ` — #${keywords[0]}` : ''
  return {
    suggestion: lastLine ? `${lastLine}${hint}` : (keywords[0] ? `#${keywords[0]} ` : ''),
    keywords,
    source: 'local',
  }
}

export async function runAiComplete(req: AiCompleteRequest): Promise<AiCompleteResponse> {
  if (!req.text?.trim() && req.task !== 'tags') {
    return { suggestion: '', source: 'local' }
  }
  if (!hasAiCredentials()) return localComplete(req)

  try {
    if (req.task === 'tags' || req.task === 'keywords' || req.task === 'summarize') {
      const prompt = `Folio AI. Locale: ${req.locale ?? 'ko'}.
Task: ${req.task}
Text:
"""
${req.text.slice(0, 6000)}
"""
Context: ${req.context?.slice(0, 1500) ?? ''}
Existing tags: ${(req.existingTags ?? []).join(', ')}

Return JSON:
{
  "suggestion": "string (summary or completion)",
  "tags": ["tag1","tag2"],
  "keywords": ["k1","k2"]
}`
      const result = await callLlmJson<{
        suggestion?: string
        tags?: string[]
        keywords?: string[]
      }>(prompt)
      if (!result) return localComplete(req)
      return {
        suggestion: typeof result.data.suggestion === 'string' ? result.data.suggestion : '',
        tags: Array.isArray(result.data.tags) ? result.data.tags.map(String) : undefined,
        keywords: Array.isArray(result.data.keywords) ? result.data.keywords.map(String) : undefined,
        source: 'ai',
        provider: result.provider,
        model: result.model,
      }
    }

    const prompt = `Continue or complete the user's writing naturally in the same language.
Task: ${req.task}
Prefix/selection:
"""
${req.text.slice(-2000)}
"""
Return only the continuation text (no quotes).`
    const result = await callLlmText(prompt)
    if (!result) return localComplete(req)
    return {
      suggestion: result.text.trim(),
      source: 'ai',
      provider: result.provider,
      model: result.model,
    }
  } catch (err) {
    console.warn('[AI complete] fallback local:', err)
    return localComplete(req)
  }
}
