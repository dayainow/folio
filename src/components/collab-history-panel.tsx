'use client'

/**
 * P43 — 변경 이력 · diff 뷰 · 복원
 */
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  diffLines,
  listCollabHistory,
  subscribeCollabHistory,
  type CollabHistoryEntry,
} from '@/lib/collab-history'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CollabHistoryPanel({
  roomId,
  currentText,
  onRestore,
  onClose,
}: {
  roomId: string
  currentText: string
  onRestore: (text: string) => void
  onClose: () => void
}) {
  const [entries, setEntries] = useState<CollabHistoryEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => setEntries(listCollabHistory(roomId))
    refresh()
    return subscribeCollabHistory(refresh)
  }, [roomId])

  const selected = entries.find((e) => e.id === selectedId) ?? entries[0] ?? null
  const diff = useMemo(
    () => (selected ? diffLines(selected.text, currentText) : null),
    [selected, currentText],
  )

  return (
    <div
      className="rounded-xl border border-gray-100 bg-muted/30 p-2 dark:border-gray-800"
      role="region"
      aria-label="협업 변경 이력"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">변경 이력 · Diff</span>
        <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose} aria-label="닫기">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">아직 스냅샷이 없습니다.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
          <ul className="max-h-40 space-y-1 overflow-y-auto text-[10px]">
            {entries.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={cn(
                    'w-full rounded-md px-1.5 py-1 text-left hover:bg-background',
                    (selected?.id ?? '') === e.id && 'bg-background font-medium',
                  )}
                  onClick={() => setSelectedId(e.id)}
                >
                  <span className="block truncate">{e.label}</span>
                  <span className="text-muted-foreground">
                    {new Date(e.createdAt).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="min-h-0">
            {selected && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px]"
                  onClick={() => onRestore(selected.text)}
                >
                  이 버전으로 되돌리기
                </Button>
              </div>
            )}
            <pre className="max-h-40 overflow-auto rounded-lg bg-background p-2 font-mono text-[10px] leading-relaxed">
              {diff?.lines.map((line, i) => (
                <div
                  key={`${i}-${line.type}`}
                  className={cn(
                    line.type === 'add' && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
                    line.type === 'del' && 'bg-red-500/15 text-red-800 line-through dark:text-red-300',
                  )}
                >
                  <span className="mr-1 inline-block w-3 opacity-60">
                    {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                  </span>
                  {line.text || ' '}
                </div>
              ))}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
