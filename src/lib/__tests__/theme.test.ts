import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyHighContrast,
  applyTheme,
  getHighContrast,
  getStoredTheme,
  getStoredThemePreference,
  resolveEffectiveTheme,
  setHighContrast,
  setStoredTheme,
  setStoredThemePreference,
  toggleHighContrast,
  toggleTheme,
  loadAppearance,
  saveAppearance,
  applyAppearance,
} from '@/lib/theme'
import {
  createThemePreset,
  exportPresetJson,
  importPresetJson,
  listThemePresets,
} from '@/lib/theme-presets'

describe('theme (P55/P65)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    delete document.documentElement.dataset.contrast
    delete document.documentElement.dataset.themePref
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to light and toggles dark', () => {
    expect(getStoredTheme()).toBe('light')
    expect(toggleTheme()).toBe('dark')
    expect(getStoredTheme()).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(toggleTheme()).toBe('light')
  })

  it('setStoredTheme / applyTheme persist and apply', () => {
    setStoredTheme('dark')
    expect(localStorage.getItem('folio_theme')).toBe('dark')
    applyTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('system preference resolves via matchMedia', () => {
    setStoredThemePreference('system')
    expect(getStoredThemePreference()).toBe('system')
    const dark = resolveEffectiveTheme('system')
    expect(dark === 'light' || dark === 'dark').toBe(true)
  })

  it('high contrast toggle', () => {
    expect(getHighContrast()).toBe(false)
    expect(toggleHighContrast()).toBe(true)
    expect(document.documentElement.classList.contains('high-contrast')).toBe(true)
    expect(document.documentElement.dataset.contrast).toBe('high')
    setHighContrast(false)
    expect(getHighContrast()).toBe(false)
    applyHighContrast(true)
    expect(document.documentElement.classList.contains('high-contrast')).toBe(true)
  })

  it('appearance bold / strong focus', () => {
    saveAppearance({
      fontScale: 'lg',
      boldText: true,
      strongFocus: true,
      reduceMotion: 'reduce',
      activePresetId: null,
    })
    applyAppearance(loadAppearance())
    expect(document.documentElement.dataset.fontScale).toBe('lg')
    expect(document.documentElement.classList.contains('folio-bold-text')).toBe(true)
    expect(document.documentElement.classList.contains('folio-strong-focus')).toBe(true)
    expect(document.documentElement.classList.contains('folio-reduce-motion')).toBe(true)
  })
})

describe('theme presets', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('creates and round-trips export/import', () => {
    const p = createThemePreset({ name: 'Ocean', primary: '#0ea5e9', accent: '#38bdf8' })
    expect(listThemePresets().some((x) => x.id === p.id)).toBe(true)
    const json = exportPresetJson(p)
    expect(json).toContain('folio-theme-preset')
    const imported = importPresetJson(json)
    expect(imported.name).toBe('Ocean')
    expect(imported.primary).toBe('#0ea5e9')
  })
})

describe('announce / focus helpers smoke', () => {
  it('setStoredTheme does not throw when storage fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => setStoredTheme('dark')).not.toThrow()
    spy.mockRestore()
  })
})
