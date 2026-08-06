/**
 * P64 — 키보드 단축키 바인딩 · 커스터마이징
 */
'use client'

export type ShortcutId =
  | 'command-palette'
  | 'new-journal'
  | 'new-doc'
  | 'new-task'
  | 'help'
  | 'focus-search'
  | 'open-guide'
  | 'open-export'
  | 'open-plugins'

/** @deprecated P56 호환 별칭 */
export type ShortcutAction =
  | ShortcutId
  | 'quick-journal' // → new-journal

export const SHORTCUT_EVENT = 'folio:shortcut'
export const SHORTCUTS_CHANGED_EVENT = 'folio:shortcuts-changed'

export type ShortcutDetail = { action: ShortcutId }

export type KeyBinding = {
  key: string
  mod?: boolean
  shift?: boolean
  alt?: boolean
}

export type ShortcutMeta = {
  id: ShortcutId
  label: string
  description: string
  defaultBinding: KeyBinding
}

export const SHORTCUT_DEFS: ShortcutMeta[] = [
  {
    id: 'command-palette',
    label: '커맨드 팔레트',
    description: '전체 명령 검색',
    defaultBinding: { key: 'k', mod: true },
  },
  {
    id: 'new-journal',
    label: '새 일지',
    description: 'Quick Capture / 일지 작성',
    defaultBinding: { key: 'n', mod: true },
  },
  {
    id: 'new-doc',
    label: '새 문서',
    description: '문서 탭에서 새 문서',
    defaultBinding: { key: 'n', mod: true, shift: true },
  },
  {
    id: 'new-task',
    label: '새 태스크',
    description: '보드에 태스크 추가',
    defaultBinding: { key: 't', mod: true, shift: true },
  },
  {
    id: 'help',
    label: '단축키 도움말',
    description: '단축키 목록',
    defaultBinding: { key: '/', mod: true },
  },
  {
    id: 'focus-search',
    label: '통합 검색',
    description: '콘텐츠 검색 열기',
    defaultBinding: { key: 'f', mod: true, shift: true },
  },
  {
    id: 'open-guide',
    label: '가이드',
    description: '/guide 열기',
    defaultBinding: { key: 'g', mod: true, shift: true },
  },
  {
    id: 'open-export',
    label: '내보내기',
    description: '공유·내보내기 패널',
    defaultBinding: { key: 'e', mod: true, shift: true },
  },
  {
    id: 'open-plugins',
    label: '플러그인',
    description: '플러그인 마켓',
    defaultBinding: { key: 'p', mod: true, shift: true },
  },
]

const BINDINGS_KEY = 'folio_shortcut_bindings_v1'

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return Boolean(target.closest('[contenteditable="true"]'))
}

export function matchesModShift(e: KeyboardEvent, key: string): boolean {
  return (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === key.toLowerCase()
}

export function formatBinding(b: KeyBinding): string {
  const parts: string[] = []
  if (b.mod) parts.push('⌘/Ctrl')
  if (b.shift) parts.push('Shift')
  if (b.alt) parts.push('Alt')
  const k = b.key === '/' ? '/' : b.key.toUpperCase()
  parts.push(k)
  return parts.join('+')
}

export function bindingMatches(e: KeyboardEvent, b: KeyBinding): boolean {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()
  const want = b.key.toLowerCase()
  if (key !== want) return false
  const mod = Boolean(e.metaKey || e.ctrlKey)
  if (Boolean(b.mod) !== mod) return false
  if (Boolean(b.shift) !== Boolean(e.shiftKey)) return false
  if (Boolean(b.alt) !== Boolean(e.altKey)) return false
  return true
}

export function loadShortcutBindings(): Record<ShortcutId, KeyBinding> {
  const base = Object.fromEntries(
    SHORTCUT_DEFS.map((d) => [d.id, { ...d.defaultBinding }]),
  ) as Record<ShortcutId, KeyBinding>
  if (typeof window === 'undefined') return base
  try {
    const raw = localStorage.getItem(BINDINGS_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<Record<ShortcutId, KeyBinding>>
    for (const def of SHORTCUT_DEFS) {
      const override = parsed[def.id]
      if (override?.key) {
        base[def.id] = {
          key: String(override.key).toLowerCase(),
          mod: Boolean(override.mod),
          shift: Boolean(override.shift),
          alt: Boolean(override.alt),
        }
      }
    }
  } catch {
    /* ignore */
  }
  return base
}

export function saveShortcutBindings(map: Record<ShortcutId, KeyBinding>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(BINDINGS_KEY, JSON.stringify(map))
    window.dispatchEvent(new Event(SHORTCUTS_CHANGED_EVENT))
  } catch {
    /* ignore */
  }
}

export function resetShortcutBindings(): Record<ShortcutId, KeyBinding> {
  const base = Object.fromEntries(
    SHORTCUT_DEFS.map((d) => [d.id, { ...d.defaultBinding }]),
  ) as Record<ShortcutId, KeyBinding>
  saveShortcutBindings(base)
  return base
}

export function dispatchShortcut(action: ShortcutId | 'quick-journal') {
  if (typeof window === 'undefined') return
  const normalized: ShortcutId = action === 'quick-journal' ? 'new-journal' : action
  window.dispatchEvent(
    new CustomEvent<ShortcutDetail>(SHORTCUT_EVENT, { detail: { action: normalized } }),
  )
}

/** 입력 중에도 허용하는 전역 액션 */
export const GLOBAL_WHILE_EDITING: ShortcutId[] = [
  'command-palette',
  'help',
  'new-journal',
  'new-doc',
  'new-task',
  'focus-search',
]

/** @deprecated P56 — Mod+Shift 맵 (테스트 호환) */
export const SHORTCUT_MAP: Array<{ key: string; action: ShortcutAction }> = [
  { key: 'n', action: 'quick-journal' },
  { key: 'd', action: 'new-doc' },
  { key: 't', action: 'new-task' },
  { key: 'f', action: 'focus-search' },
  { key: 'g', action: 'open-guide' },
]

export function resolveShortcut(
  e: KeyboardEvent,
  bindings: Record<ShortcutId, KeyBinding> = loadShortcutBindings(),
): ShortcutId | null {
  for (const def of SHORTCUT_DEFS) {
    if (bindingMatches(e, bindings[def.id] ?? def.defaultBinding)) return def.id
  }
  return null
}
