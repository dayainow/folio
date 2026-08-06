'use client'

/**
 * P62 — 공통 필터/정렬 드로어 (데스크톱 사이드 · 모바일 바텀 시트)
 */
import { useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEscapeToClose, useFocusTrap } from '@/lib/a11y'
import { cn } from '@/lib/utils'

export type FilterDrawerProps = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** 하단 고정 액션 (적용/초기화 등) */
  footer?: ReactNode
  className?: string
}

export function FilterDrawer({
  open,
  onClose,
  title = '필터',
  children,
  footer,
  className,
}: FilterDrawerProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)
  useEscapeToClose(open, onClose)
  useFocusTrap(open, panelRef)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'absolute flex flex-col bg-background shadow-sm outline-none',
          /* 모바일: 바텀 시트 */
          'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t border-slate-200 dark:border-slate-700',
          /* 데스크톱: 우측 드로어 */
          'sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[min(100%,22rem)] sm:rounded-none sm:border-l sm:border-t-0',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 id={titleId} className="text-sm font-semibold">
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="닫기"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer ? (
          <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}
