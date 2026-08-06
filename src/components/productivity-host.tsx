/**
 * P56/P64 — 전역 단축키 + Quick Capture + 커맨드 팔레트 호스트
 */
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { QuickCaptureModal } from '@/components/quick-capture'
import { CommandPalette } from '@/components/command-palette'
import { ShortcutHelpDialog, ShortcutSettingsPanel } from '@/components/shortcut-settings'
import type { CommandHandlers } from '@/lib/command-registry'
import {
  GLOBAL_WHILE_EDITING,
  SHORTCUT_EVENT,
  SHORTCUTS_CHANGED_EVENT,
  isEditableTarget,
  loadShortcutBindings,
  resolveShortcut,
  type ShortcutDetail,
  type ShortcutId,
} from '@/lib/shortcuts'

export type ProductivityHostProps = {
  onNewDoc?: () => void
  onNewTask?: () => void
  onFocusSearch?: () => void
  onJournalSaved?: (date: string) => void
  onOpenJournalTab?: () => void
  onOpenDocsTab?: () => void
  onOpenBoardTab?: () => void
  onOpenProcessTab?: () => void
}

export function ProductivityHost({
  onNewDoc,
  onNewTask,
  onFocusSearch,
  onJournalSaved,
  onOpenJournalTab,
  onOpenDocsTab,
  onOpenBoardTab,
  onOpenProcessTab,
}: ProductivityHostProps) {
  const [captureOpen, setCaptureOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bindingsVersion, setBindingsVersion] = useState(0)

  useEffect(() => {
    const onChange = () => setBindingsVersion((v) => v + 1)
    window.addEventListener(SHORTCUTS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(SHORTCUTS_CHANGED_EVENT, onChange)
  }, [])

  const run = useCallback(
    (action: ShortcutId) => {
      switch (action) {
        case 'command-palette':
          setPaletteOpen(true)
          break
        case 'new-journal':
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
        case 'help':
          setHelpOpen(true)
          break
        case 'focus-search':
          window.dispatchEvent(new Event('folio:focus-search'))
          onFocusSearch?.()
          break
        case 'open-guide':
          window.location.assign('/guide')
          break
        case 'open-export':
          window.dispatchEvent(new Event('folio:open-export'))
          break
        case 'open-plugins':
          window.dispatchEvent(new Event('folio:open-plugins'))
          break
      }
    },
    [onNewDoc, onNewTask, onFocusSearch, onOpenJournalTab],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // palette/help open: don't steal keys except escape handled inside
      if (paletteOpen || helpOpen || settingsOpen) return
      const bindings = loadShortcutBindings()
      void bindingsVersion
      const action = resolveShortcut(e, bindings)
      if (!action) return
      if (!GLOBAL_WHILE_EDITING.includes(action) && isEditableTarget(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      run(action)
    }
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<ShortcutDetail>).detail
      if (detail?.action) run(detail.action)
    }
    const onOpenPalette = () => setPaletteOpen(true)
    const onOpenHelp = () => setHelpOpen(true)
    const onOpenSettings = () => setSettingsOpen(true)

    window.addEventListener('keydown', onKey, true)
    window.addEventListener(SHORTCUT_EVENT, onCustom as EventListener)
    window.addEventListener('folio:open-command-palette', onOpenPalette)
    window.addEventListener('folio:open-shortcut-help', onOpenHelp)
    window.addEventListener('folio:open-shortcut-settings', onOpenSettings)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener(SHORTCUT_EVENT, onCustom as EventListener)
      window.removeEventListener('folio:open-command-palette', onOpenPalette)
      window.removeEventListener('folio:open-shortcut-help', onOpenHelp)
      window.removeEventListener('folio:open-shortcut-settings', onOpenSettings)
    }
  }, [run, paletteOpen, helpOpen, settingsOpen, bindingsVersion])

  const handlers: CommandHandlers = useMemo(
    () => ({
      openJournalTab: () => onOpenJournalTab?.(),
      openDocsTab: () => onOpenDocsTab?.() ?? onNewDoc?.(),
      openBoardTab: () => onOpenBoardTab?.() ?? onNewTask?.(),
      openProcessTab: () => onOpenProcessTab?.(),
      openQuickCapture: () => {
        setCaptureOpen(true)
        onOpenJournalTab?.()
      },
      newDoc: () => {
        window.dispatchEvent(new Event('folio:new-doc'))
        onNewDoc?.()
      },
      newTask: () => {
        window.dispatchEvent(new Event('folio:new-task'))
        onNewTask?.()
      },
      focusSearch: () => {
        window.dispatchEvent(new Event('folio:focus-search'))
        onFocusSearch?.()
      },
      openAdvancedSearch: () => window.dispatchEvent(new Event('folio:open-advanced-search')),
      openExport: () => window.dispatchEvent(new Event('folio:open-export')),
      openReports: () => window.dispatchEvent(new Event('folio:open-reports')),
      openPlugins: () => window.dispatchEvent(new Event('folio:open-plugins')),
      openShortcutSettings: () => setSettingsOpen(true),
      openHelp: () => setHelpOpen(true),
      openGuide: () => window.location.assign('/guide'),
    }),
    [
      onOpenJournalTab,
      onOpenDocsTab,
      onOpenBoardTab,
      onOpenProcessTab,
      onNewDoc,
      onNewTask,
      onFocusSearch,
    ],
  )

  return (
    <>
      <QuickCaptureModal
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onSaved={(date) => {
          onJournalSaved?.(date)
        }}
      />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} handlers={handlers} />
      <ShortcutHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ShortcutSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
