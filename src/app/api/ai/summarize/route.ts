import { NextResponse } from 'next/server';
import { generateAiSummary, AiSummaryRequest } from '@/lib/ai-summary';

export async function POST(req: Request) {
  try {
    const body: AiSummaryRequest = await req.json();
    if (!body || !body.type) {
      return NextResponse.json(
        { error: 'Missing required field: type' },
        { status: 400 }
      );
    }

    const summary = await generateAiSummary(body);
    return NextResponse.json(summary);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[API /api/ai/summarize Error]:', err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
