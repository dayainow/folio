import { describe, expect, it, beforeEach } from 'vitest'
import {
  bindingMatches,
  formatBinding,
  loadShortcutBindings,
  resetShortcutBindings,
  resolveShortcut,
  type KeyBinding,
} from '@/lib/shortcuts'
import { detectSlashQuery, filterSlashCommands, applySlashCommand } from '@/lib/slash-commands'
import { buildCommands, filterCommands, type CommandHandlers } from '@/lib/command-registry'

function fakeKey(partial: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    key: partial.key,
    metaKey: Boolean(partial.metaKey),
    ctrlKey: Boolean(partial.ctrlKey),
    shiftKey: Boolean(partial.shiftKey),
    altKey: Boolean(partial.altKey),
  } as KeyboardEvent
}

describe('shortcuts P64', () => {
  beforeEach(() => {
    localStorage.clear()
    resetShortcutBindings()
  })

  it('defaults: Cmd+K palette, Cmd+N journal, Cmd+Shift+N doc', () => {
    const b = loadShortcutBindings()
    expect(resolveShortcut(fakeKey({ key: 'k', metaKey: true }), b)).toBe('command-palette')
    expect(resolveShortcut(fakeKey({ key: 'n', metaKey: true }), b)).toBe('new-journal')
    expect(resolveShortcut(fakeKey({ key: 'n', metaKey: true, shiftKey: true }), b)).toBe('new-doc')
    expect(resolveShortcut(fakeKey({ key: 't', metaKey: true, shiftKey: true }), b)).toBe('new-task')
    expect(resolveShortcut(fakeKey({ key: '/', metaKey: true }), b)).toBe('help')
    expect(resolveShortcut(fakeKey({ key: 'f', metaKey: true, shiftKey: true }), b)).toBe(
      'focus-search',
    )
  })

  it('formatBinding and bindingMatches', () => {
    const b: KeyBinding = { key: 'e', mod: true, shift: true }
    expect(formatBinding(b)).toContain('E')
    expect(bindingMatches(fakeKey({ key: 'e', metaKey: true, shiftKey: true }), b)).toBe(true)
    expect(bindingMatches(fakeKey({ key: 'e', metaKey: true }), b)).toBe(false)
  })
})

describe('slash commands', () => {
  it('detects slash at line start', () => {
    expect(detectSlashQuery('/he', 3)).toEqual({ start: 0, query: 'he' })
    expect(detectSlashQuery('hi /tag', 7)).toEqual({ start: 3, query: 'tag' })
    expect(detectSlashQuery('nope', 4)).toBeNull()
  })

  it('filters and applies', () => {
    expect(filterSlashCommands('머리').some((c) => c.id === 'h1')).toBe(true)
    const { next, caret } = applySlashCommand('hello /', 7, 6, {
      id: 'h2',
      label: 'h2',
      hint: '',
      insert: '## ',
    })
    expect(next).toBe('hello ## ')
    expect(caret).toBe(9)
  })
})

describe('command registry', () => {
  it('filters by keyword', () => {
    const noop = () => {}
    const h: CommandHandlers = {
      openJournalTab: noop,
      openDocsTab: noop,
      openBoardTab: noop,
      openProcessTab: noop,
      openQuickCapture: noop,
      newDoc: noop,
      newTask: noop,
      focusSearch: noop,
      openAdvancedSearch: noop,
      openExport: noop,
      openReports: noop,
      openPlugins: noop,
      openShortcutSettings: noop,
      openThemeSettings: noop,
      openHelp: noop,
      openGuide: noop,
    }
    const cmds = buildCommands(h)
    expect(filterCommands(cmds, '일지').some((c) => c.id === 'create-journal')).toBe(true)
    expect(filterCommands(cmds, '플러그인').some((c) => c.id === 'tool-plugins')).toBe(true)
  })
})
