/**
 * GET /api/mcp/store — .folio-mcp 전체 스냅샷 (UI 동기화용)
 */
import { NextResponse } from 'next/server'
import { loadDocs, loadJournals, loadTasks, dataDir, projectRoot } from '@/mcp/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const [journals, docs, boards] = await Promise.all([
    loadJournals(),
    loadDocs(),
    loadTasks(),
  ])
  return NextResponse.json({
    journals,
    docs,
    boards,
    meta: {
      root: projectRoot(),
      dataDir: dataDir(),
      counts: {
        journals: Object.keys(journals).length,
        docs: docs.length,
        boards: boards.length,
      },
    },
  })
}
