/**
 * P56 — 전역 단축키 + Quick Capture 호스트
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { QuickCaptureModal } from '@/components/quick-capture'
import {
  SHORTCUT_EVENT,
  isEditableTarget,
  resolveShortcut,
  type ShortcutAction,
  type ShortcutDetail,
} from '@/lib/shortcuts'

export type ProductivityHostProps = {
  onNewDoc?: () => void
  onNewTask?: () => void
  onFocusSearch?: () => void
  onJournalSaved?: (date: string) => void
  onOpenJournalTab?: () => void
}

export function ProductivityHost({
  onNewDoc,
  onNewTask,
  onFocusSearch,
  onJournalSaved,
  onOpenJournalTab,
}: ProductivityHostProps) {
  const [captureOpen, setCaptureOpen] = useState(false)

  const run = useCallback(
    (action: ShortcutAction) => {
      switch (action) {
        case 'quick-journal':
          setCaptureOpen(true)
          onOpenJournalTab?.()
          break
        case 'new-doc':
          window.dispatchEvent(new Event('folio:new-doc'))
          onNewDoc?.()
          break
        case 'new-task':
          window.dispatchEvent(new Event('folio:new-task'))
          onNewTask?.()
          break
        case 'focus-search':
          window.dispatchEvent(new Event('folio:focus-search'))
          onFocusSearch?.()
          break
        case 'open-guide':
          window.location.assign('/guide')
          break
      }
    },
    [onNewDoc, onNewTask, onFocusSearch, onOpenJournalTab],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = resolveShortcut(e)
      if (!action) return
      // 입력 중에도 전역 캡처는 허용, 그 외는 편집 중이면 스킵
      if (action !== 'quick-journal' && isEditableTarget(e.target)) return
      e.preventDefault()
      run(action)
    }
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<ShortcutDetail>).detail
      if (detail?.action) run(detail.action)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(SHORTCUT_EVENT, onCustom as EventListener)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(SHORTCUT_EVENT, onCustom as EventListener)
    }
  }, [run])

  return (
    <QuickCaptureModal
      open={captureOpen}
      onClose={() => setCaptureOpen(false)}
      onSaved={(date) => {
        onJournalSaved?.(date)
      }}
    />
  )
}
