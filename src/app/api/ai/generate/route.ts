import { NextResponse } from 'next/server'
import { runAiComplete, type AiCompleteRequest } from '@/lib/ai-complete'
import { runAiEdit, type AiEditRequest } from '@/lib/ai-edit'
import { runAiAnalytics, type AiAnalyticsRequest } from '@/lib/ai-analytics'
import { answerWithGrounding, type GroundingSource } from '@/lib/ai-grounded'
import { extractActionItems } from '@/lib/ai-action-items'

type Body =
  | ({ kind: 'complete' } & AiCompleteRequest)
  | ({ kind: 'edit' } & AiEditRequest)
  | ({ kind: 'analyze' } & AiAnalyticsRequest)
  | { kind: 'answer'; question: string; sources: GroundingSource[] }
  | { kind: 'actions'; notes: string }

/**
 * POST /api/ai/generate
 * kind: complete | edit | analyze
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body
    if (!body?.kind) {
      return NextResponse.json({ error: 'Missing kind' }, { status: 400 })
    }
    if (body.kind === 'complete') {
      const result = await runAiComplete(body)
      return NextResponse.json(result)
    }
    if (body.kind === 'edit') {
      if (!body.action || !body.selection) {
        return NextResponse.json({ error: 'edit requires action + selection' }, { status: 400 })
      }
      const result = await runAiEdit(body)
      return NextResponse.json(result)
    }
    if (body.kind === 'analyze') {
      const result = await runAiAnalytics(body)
      return NextResponse.json(result)
    }
    if (body.kind === 'answer') {
      if (!body.question?.trim() || !Array.isArray(body.sources)) {
        return NextResponse.json({ error: 'answer requires question + sources' }, { status: 400 })
      }
      const result = await answerWithGrounding(body.question, body.sources)
      return NextResponse.json(result)
    }
    if (body.kind === 'actions') {
      if (!body.notes?.trim()) {
        return NextResponse.json({ error: 'actions requires notes' }, { status: 400 })
      }
      return NextResponse.json(await extractActionItems(body.notes))
    }
    return NextResponse.json({ error: 'Unknown kind' }, { status: 400 })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API /api/ai/generate]:', err)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
