'use client'

/**
 * 단순화된 요약 사이드바 — 핵심 위젯 + 접힌 「더보기」
 */
import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  CoreSummaryWidgets,
  ExtraSummaryWidgets,
  type WidgetSidebarProps,
} from '@/components/widgets'
import { cn } from '@/lib/utils'

export type SummarySidebarProps = WidgetSidebarProps & {
  /** 시스템/도구 footer (저장 모드 · 관측 · 로그인 등) */
  extras?: ReactNode
}

export function SummarySidebar({
  onOpenTab,
  onBookmarkNavigate,
  journalPreview,
  footer,
  extras,
  className,
  defaultExtrasOpen = false,
}: SummarySidebarProps) {
  const [open, setOpen] = useState(defaultExtrasOpen)
  const moreContent = extras ?? footer

  return (
    <aside
      aria-label="요약 사이드바"
      className={cn('flex h-full w-full flex-col', className)}
    >
      <CoreSummaryWidgets onOpenTab={onOpenTab} journalPreview={journalPreview} />

      <div className="mt-5 space-y-3">
        <Separator />
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full justify-between gap-2 px-3 text-xs font-medium"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{open ? '접기' : '더보기'}</span>
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </Button>

        {open && (
          <div className="space-y-4 pb-2">
            <ExtraSummaryWidgets onBookmarkNavigate={onBookmarkNavigate} />
            {moreContent && (
              <div className="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  도구 · 시스템
                </p>
                {moreContent}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
