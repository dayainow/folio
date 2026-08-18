'use client'

/**
 * P59 — 문서 버전 Diff 뷰어 (라인/단어 · 복원 · 체크아웃)
 */
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  diffDocContents,
  diffWords,
  type DocVersion,
} from '@/lib/doc-versions'
import { GitCompare, X } from 'lucide-react'

export type DocDiffViewerProps = {
  open: boolean
  onClose: () => void
  /** 비교 기준(이전) */
  before: DocVersion | { label: string; title: string; content: string }
  /** 비교 대상(이후) — 보통 현재 */
  after: DocVersion | { label: string; title: string; content: string }
  onRestore?: () => void
  onCheckout?: (newTitle: string) => void
}

export function DocDiffViewer({
  open,
  onClose,
  before,
  after,
  onRestore,
  onCheckout,
}: DocDiffViewerProps) {
  const [mode, setMode] = useState<'line' | 'word'>('line')
  const [checkoutName, setCheckoutName] = useState('')

  const lineDiff = useMemo(
    () => diffDocContents(before.content, after.content),
    [before.content, after.content],
  )
  const wordDiff = useMemo(
    () => diffWords(before.content, after.content),
    [before.content, after.content],
  )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="문서 버전 비교"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
      >
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <GitCompare className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">버전 비교</h2>
            <p className="truncate text-[11px] text-muted-foreground">
              {before.label} → {after.label}
              {before.title !== after.title ? ` · 제목: ${before.title} → ${after.title}` : ''}
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={mode === 'line' ? 'default' : 'outline'}
              className="h-7 text-[11px]"
              onClick={() => setMode('line')}
            >
              줄
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'word' ? 'default' : 'outline'}
              className="h-7 text-[11px]"
              onClick={() => setMode('word')}
            >
              단어
            </Button>
          </div>
          <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          {mode === 'line' ? (
            <pre className="rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
              {lineDiff.lines.map((line, i) => (
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
          ) : (
            <div className="rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {wordDiff.map((part, i) => (
                <span
                  key={`${i}-${part.type}`}
                  className={cn(
                    part.type === 'add' && 'bg-emerald-500/25 text-emerald-900 dark:text-emerald-200',
                    part.type === 'del' && 'bg-red-500/25 text-red-900 line-through dark:text-red-200',
                  )}
                >
                  {part.text}
                </span>
              ))}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
          {onRestore && (
            <Button type="button" size="sm" className="h-8 text-xs" onClick={onRestore}>
              {before.label}로 복원
            </Button>
          )}
          {onCheckout && (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              <Input
                value={checkoutName}
                onChange={(e) => setCheckoutName(e.target.value)}
                placeholder={`${before.title} (${before.label})`}
                className="h-8 max-w-xs text-xs"
                aria-label="체크아웃 문서 제목"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() =>
                  onCheckout(checkoutName.trim() || `${before.title} (${before.label})`)
                }
              >
                새 문서로 체크아웃
              </Button>
            </div>
          )}
          <Button type="button" size="sm" variant="ghost" className="ml-auto h-8 text-xs" onClick={onClose}>
            닫기
          </Button>
        </footer>
      </div>
    </div>
  )
}
