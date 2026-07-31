'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { fetchAndApplyMcpStore } from '@/lib/mcp-sync'

/**
 * MCP(.folio-mcp) → 브라우저 Folio UI 가져오기
 */
export function McpSyncButton() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setMsg(null)
    const result = await fetchAndApplyMcpStore()
    setBusy(false)
    if (!result.ok) {
      setMsg(result.error || '가져오기 실패')
      return
    }
    setMsg(
      `일지 ${result.journalsMerged} · 문서 ${result.docsUpserted} · 보드 ${result.tasksUpserted}`,
    )
    // 탭 데이터가 메모리에 있을 수 있어 새로고침 권장 신호
    window.setTimeout(() => {
      if (window.confirm('MCP 데이터를 반영했습니다. 화면을 새로고침할까요?')) {
        window.location.reload()
      }
    }, 100)
  }

  return (
    <div className="relative inline-flex flex-col items-end">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5 h-11 min-h-[44px] px-3 text-xs sm:h-7 sm:min-h-0"
        disabled={busy}
        onClick={() => void run()}
        aria-label="MCP 데이터 가져오기"
        title="IDE/Git이 남긴 .folio-mcp 기록을 Folio 화면에 반영"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        MCP 가져오기
      </Button>
      {msg && (
        <span className="absolute top-full right-0 z-20 mt-1 max-w-[220px] rounded-md border border-gray-100 bg-white px-2 py-1 text-[10px] text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          {msg}
        </span>
      )}
    </div>
  )
}
