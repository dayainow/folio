import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyHighContrast,
  applyTheme,
  getHighContrast,
  getStoredTheme,
  setHighContrast,
  setStoredTheme,
  toggleHighContrast,
  toggleTheme,
} from '@/lib/theme'

describe('theme (P55)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    delete document.documentElement.dataset.contrast
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
