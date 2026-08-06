import { NextResponse } from 'next/server'
import {
  recommendRelated,
  semanticSearchLocal,
  type SemanticDoc,
} from '@/lib/ai-semantic'

/**
 * POST /api/ai/semantic
 * { query, docs, mode?: 'search'|'related', seed?, excludeId?, limit? }
 * 서버에서도 동일 로컬 임베딩 사용 (클라이언트가 docs를 전달)
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      query?: string
      seed?: string
      docs?: SemanticDoc[]
      mode?: 'search' | 'related'
      excludeId?: string
      limit?: number
    }
    const docs = Array.isArray(body.docs) ? body.docs.slice(0, 400) : []
    const limit = Math.min(40, Math.max(1, body.limit ?? 12))
    if (body.mode === 'related') {
      const seed = body.seed ?? body.query ?? ''
      if (!seed.trim()) return NextResponse.json({ error: 'Missing seed' }, { status: 400 })
      const hits = recommendRelated(seed, docs, body.excludeId, limit)
      return NextResponse.json({
        hits,
        summary: hits.length
          ? `관련 ${hits.length}건: ${hits
              .slice(0, 3)
              .map((h) => h.title)
              .join(', ')}`
          : '관련 항목 없음',
      })
    }
    const query = body.query ?? ''
    if (!query.trim()) return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    const hits = semanticSearchLocal(query, docs, limit)
    return NextResponse.json({
      hits,
      summary: hits.length
        ? `"${query}" 의미 검색 ${hits.length}건 (관련성 순)`
        : '일치하는 결과가 없습니다',
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API /api/ai/semantic]:', err)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
