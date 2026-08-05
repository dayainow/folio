/**
 * P56 — 전역 키보드 단축키 (Cmd/Ctrl+Shift+…)
 */
'use client'

export type ShortcutAction =
  | 'quick-journal'
  | 'new-doc'
  | 'new-task'
  | 'focus-search'
  | 'open-guide'

export const SHORTCUT_EVENT = 'folio:shortcut'

export type ShortcutDetail = { action: ShortcutAction }

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return Boolean(target.closest('[contenteditable="true"]'))
}

/** Cmd/Ctrl+Shift+key */
export function matchesModShift(e: KeyboardEvent, key: string): boolean {
  return (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === key.toLowerCase()
}

export function dispatchShortcut(action: ShortcutAction) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<ShortcutDetail>(SHORTCUT_EVENT, { detail: { action } }),
  )
}

/** 키 → 액션 맵 */
export const SHORTCUT_MAP: Array<{ key: string; action: ShortcutAction }> = [
  { key: 'n', action: 'quick-journal' },
  { key: 'd', action: 'new-doc' },
  { key: 't', action: 'new-task' },
  { key: 'f', action: 'focus-search' },
  { key: 'g', action: 'open-guide' },
]

export function resolveShortcut(e: KeyboardEvent): ShortcutAction | null {
  for (const { key, action } of SHORTCUT_MAP) {
    if (matchesModShift(e, key)) return action
  }
  return null
}
