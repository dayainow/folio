'use client'

/**
 * P48 — 3-way merge 충돌 해결 UI
 */
import { useMemo, useState } from 'react'
import { GitMerge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  resolveConflictMarkers,
  suggestConflictResolution,
  threeWayMerge,
} from '@/lib/conflict-merge'
import { cn } from '@/lib/utils'

export function ConflictMergeDialog({
  open,
  onClose,
  base,
  local,
  remote,
  onApply,
}: {
  open: boolean
  onClose: () => void
  base: string
  local: string
  remote: string
  onApply: (merged: string) => void
}) {
  const suggestion = useMemo(
    () => suggestConflictResolution(base, local, remote),
    [base, local, remote],
  )
  const detail = useMemo(() => threeWayMerge(base, local, remote), [base, local, remote])
  const [draft, setDraft] = useState(suggestion.autoMerged)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="충돌 해결"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <GitMerge className="h-4 w-4 text-amber-600" />
          <div>
            <h2 className="text-sm font-semibold">충돌 해결</h2>
            <p className="text-[11px] text-muted-foreground">{suggestion.summary}</p>
          </div>
          <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={onClose}>
            닫기
          </Button>
        </header>

        <div className="grid gap-2 overflow-y-auto p-4 sm:grid-cols-3">
          <Preview label="Base" text={base} />
          <Preview label="Local" text={local} tone="local" />
          <Preview label="Remote" text={remote} tone="remote" />
        </div>

        <div className="flex flex-wrap gap-1.5 px-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => setDraft(detail.merged)}
          >
            자동 병합
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => setDraft(resolveConflictMarkers(detail.merged, 'local'))}
          >
            전부 Local
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => setDraft(resolveConflictMarkers(detail.merged, 'remote'))}
          >
            전부 Remote
          </Button>
        </div>

        <textarea
          className="mx-4 mt-2 min-h-[10rem] flex-1 rounded-xl border border-border bg-muted/20 p-3 font-mono text-xs"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />

        <footer className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onApply(draft)
              onClose()
            }}
          >
            적용
          </Button>
        </footer>
      </div>
    </div>
  )
}

function Preview({
  label,
  text,
  tone,
}: {
  label: string
  text: string
  tone?: 'local' | 'remote'
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-2',
        tone === 'local' && 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900',
        tone === 'remote' && 'border-sky-200 bg-sky-50/50 dark:border-sky-900',
      )}
    >
      <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words text-[10px]">
        {text || '(비어 있음)'}
      </pre>
    </div>
  )
}
