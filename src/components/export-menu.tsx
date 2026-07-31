'use client'

/**
 * P32 — 내보내기 드롭다운 + 진행 표시
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'

export type ExportMenuItem = {
  id: string
  label: string
  description?: string
  disabled?: boolean
  /** 선택 시 실행 (progress 0~1) */
  run: (setProgress: (ratio: number, label?: string) => void) => Promise<void>
}

export function ExportMenu({
  items,
  label = '내보내기',
  size = 'sm',
  align = 'right',
  extra,
}: {
  items: ExportMenuItem[]
  label?: string
  size?: 'sm' | 'default'
  align?: 'left' | 'right'
  /** 드롭다운 상단 추가 UI (날짜 범위 등) */
  extra?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const runItem = async (item: ExportMenuItem) => {
    if (item.disabled || busy) return
    setOpen(false)
    setBusy(true)
    setError(null)
    setProgress(0)
    setProgressLabel('준비 중…')
    try {
      await item.run((ratio, lbl) => {
        setProgress(Math.max(0, Math.min(1, ratio)))
        if (lbl) setProgressLabel(lbl)
      })
      setProgress(1)
      setProgressLabel('완료')
      window.setTimeout(() => {
        setBusy(false)
        setProgress(0)
        setProgressLabel(null)
      }, 600)
    } catch (err) {
      setError(err instanceof Error ? err.message : '내보내기에 실패했습니다.')
      setBusy(false)
      setProgressLabel(null)
    }
  }

  return (
    <div ref={rootRef} className="relative inline-flex flex-col items-stretch">
      <Button
        type="button"
        size={size}
        variant="outline"
        className="gap-1.5"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {busy ? '내보내는 중…' : label}
      </Button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className={`absolute top-full z-30 mt-1 min-w-[220px] rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {extra && <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">{extra}</div>}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled || busy}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-xs hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-800"
              onClick={() => void runItem(item)}
            >
              <span className="font-medium text-gray-800 dark:text-gray-100">{item.label}</span>
              {item.description && (
                <span className="text-[10px] text-gray-400">{item.description}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {(busy || error) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border border-gray-100 bg-white px-2.5 py-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {busy && (
            <>
              <div className="mb-1 flex justify-between text-[10px] text-gray-500">
                <span>{progressLabel ?? '처리 중…'}</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full rounded-full bg-gray-900 transition-[width] duration-150 dark:bg-gray-100"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="text-[11px] text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
