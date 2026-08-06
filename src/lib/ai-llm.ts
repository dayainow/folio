/**
 * P67 — 멀티 프로바이더 LLM (OpenAI · Anthropic · Gemini)
 * 키 없으면 null → 호출부가 룰/로컬 폴백
 */
export type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'auto'

export type AiModelId =
  | 'gpt-4'
  | 'gpt-4o-mini'
  | 'claude-3'
  | 'claude-3-5-sonnet'
  | 'gemini-pro'
  | 'gemini-1.5-flash'
  | string

export type LlmTextResult = {
  text: string
  provider: Exclude<AiProvider, 'auto'>
  model: string
}

export type LlmJsonResult<T = Record<string, unknown>> = {
  data: T
  provider: Exclude<AiProvider, 'auto'>
  model: string
}

export function cleanAndParseJson(rawText: string): Record<string, unknown> {
  const cleaned = rawText
    .replace(/^```(json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const startIdx = cleaned.indexOf('{')
  const endIdx = cleaned.lastIndexOf('}')
  if (startIdx !== -1 && endIdx !== -1 && startIdx <= endIdx) {
    return JSON.parse(cleaned.slice(startIdx, endIdx + 1)) as Record<string, unknown>
  }
  return JSON.parse(cleaned) as Record<string, unknown>
}

export function resolveAiProvider(preferred?: AiProvider): Exclude<AiProvider, 'auto'> | null {
  const pref = preferred ?? (process.env.FOLIO_AI_PROVIDER as AiProvider | undefined) ?? 'auto'
  if (pref === 'openai' && process.env.OPENAI_API_KEY) return 'openai'
  if (pref === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (pref === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini'
  if (pref !== 'auto') return null
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (process.env.GEMINI_API_KEY) return 'gemini'
  return null
}

export function resolveAiModel(provider: Exclude<AiProvider, 'auto'>, override?: string): string {
  if (override?.trim()) return override.trim()
  const fromEnv = process.env.FOLIO_AI_MODEL?.trim()
  if (fromEnv) return fromEnv
  if (provider === 'openai') return process.env.OPENAI_MODEL_NAME?.trim() || 'gpt-4o-mini'
  if (provider === 'anthropic') return process.env.ANTHROPIC_MODEL_NAME?.trim() || 'claude-3-5-sonnet-20241022'
  return process.env.GEMINI_MODEL_NAME?.trim() || 'gemini-1.5-flash'
}

export function hasAiCredentials(): boolean {
  return resolveAiProvider('auto') !== null
}

async function callOpenAi(model: string, prompt: string, json: boolean): Promise<string> {
  const key = process.env.OPENAI_API_KEY!
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model === 'gpt-4' ? 'gpt-4o' : model,
      temperature: 0.3,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: 'You are Folio AI assistant. Reply in the user language.' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty OpenAI response')
  return text
}

async function callAnthropic(model: string, prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY!
  const modelId = model === 'claude-3' ? 'claude-3-5-sonnet-20241022' : model
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 2048,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`)
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  const text = data.content?.find((c) => c.type === 'text')?.text
  if (!text) throw new Error('Empty Anthropic response')
  return text
}

async function callGemini(model: string, prompt: string, json: boolean): Promise<string> {
  const key = process.env.GEMINI_API_KEY!
  const modelId = model === 'gemini-pro' ? 'gemini-1.5-pro' : model
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    },
  )
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty Gemini response')
  return text
}

export async function callLlmText(
  prompt: string,
  opts?: { provider?: AiProvider; model?: string; json?: boolean },
): Promise<LlmTextResult | null> {
  const provider = resolveAiProvider(opts?.provider)
  if (!provider) return null
  const model = resolveAiModel(provider, opts?.model)
  const json = opts?.json ?? false
  let text: string
  if (provider === 'openai') text = await callOpenAi(model, prompt, json)
  else if (provider === 'anthropic') text = await callAnthropic(model, prompt)
  else text = await callGemini(model, prompt, json)
  return { text, provider, model }
}

export async function callLlmJson<T extends Record<string, unknown> = Record<string, unknown>>(
  prompt: string,
  opts?: { provider?: AiProvider; model?: string },
): Promise<LlmJsonResult<T> | null> {
  const result = await callLlmText(prompt, { ...opts, json: true })
  if (!result) return null
  const data = cleanAndParseJson(result.text) as T
  return { data, provider: result.provider, model: result.model }
}
