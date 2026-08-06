/**
 * P67 — AI 편집 (요약/확장/재작성/문법/번역)
 */
import { callLlmText, hasAiCredentials } from '@/lib/ai-llm'

export type AiEditAction =
  | 'summarize'
  | 'expand'
  | 'rewrite'
  | 'grammar'
  | 'translate'

export type AiEditRequest = {
  action: AiEditAction
  selection: string
  context?: string
  /** translate target: ko | en | ja | ... */
  targetLang?: string
  tone?: 'neutral' | 'formal' | 'casual'
}

export type AiEditResponse = {
  result: string
  source: 'ai' | 'local'
  provider?: string
  model?: string
}

function localEdit(req: AiEditRequest): AiEditResponse {
  const s = req.selection.trim()
  if (!s) return { result: '', source: 'local' }
  if (req.action === 'summarize') {
    const line = s.split(/\n/).map((l) => l.trim()).find(Boolean) ?? s
    return { result: line.slice(0, 200), source: 'local' }
  }
  if (req.action === 'expand') {
    return { result: `${s}\n\n(자세한 설명·예시·다음 단계를 추가하세요.)`, source: 'local' }
  }
  if (req.action === 'rewrite') {
    return { result: s.replace(/\s+/g, ' ').trim(), source: 'local' }
  }
  if (req.action === 'grammar') {
    return { result: s, source: 'local' }
  }
  // translate local: mark only
  const lang = req.targetLang ?? 'en'
  return { result: `[${lang}] ${s}`, source: 'local' }
}

const ACTION_PROMPT: Record<AiEditAction, string> = {
  summarize: 'Summarize the selection concisely while keeping key facts.',
  expand: 'Expand the selection with useful detail, examples, and clarity.',
  rewrite: 'Rewrite for clarity and flow without changing meaning.',
  grammar: 'Fix grammar, spelling, and style. Keep the original language.',
  translate: 'Translate the selection accurately.',
}

export async function runAiEdit(req: AiEditRequest): Promise<AiEditResponse> {
  if (!req.selection?.trim()) return { result: '', source: 'local' }
  if (!hasAiCredentials()) return localEdit(req)

  try {
    const prompt = `You are Folio writing assistant.
Action: ${ACTION_PROMPT[req.action]}
Tone: ${req.tone ?? 'neutral'}
Target language (for translate): ${req.targetLang ?? 'same as input'}
Context (optional): ${req.context?.slice(0, 1000) ?? ''}

Selection:
"""
${req.selection.slice(0, 8000)}
"""

Return only the edited text.`
    const result = await callLlmText(prompt)
    if (!result) return localEdit(req)
    return {
      result: result.text.trim(),
      source: 'ai',
      provider: result.provider,
      model: result.model,
    }
  } catch (err) {
    console.warn('[AI edit] fallback local:', err)
    return localEdit(req)
  }
}
