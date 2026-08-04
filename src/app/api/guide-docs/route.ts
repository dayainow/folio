import { NextResponse } from 'next/server'
import { loadGuideDocs, resolveDocsLocale } from '@/lib/docs-locale'

export const runtime = 'nodejs'

/** GET /api/guide-docs?locale=ko|en|ja — 언어별 가이드 마크다운 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const locale = resolveDocsLocale(searchParams.get('locale'))
  const docs = await loadGuideDocs(locale)
  return NextResponse.json(docs)
}
