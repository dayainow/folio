/**
 * light/dark 테마 + 고대비 모드 (P55)
 */
'use client'

const THEME_KEY = 'folio_theme'
const CONTRAST_KEY = 'folio_high_contrast'

export type ThemeMode = 'light' | 'dark'

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', mode === 'dark')
}

export function setStoredTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, mode)
  } catch {
    /* ignore */
  }
  applyTheme(mode)
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = getStoredTheme() === 'dark' ? 'light' : 'dark'
  setStoredTheme(next)
  return next
}

/** P55 — WCAG 고대비 */
export function getHighContrast(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(CONTRAST_KEY) === '1'
  } catch {
    return false
  }
}

export function applyHighContrast(enabled: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('high-contrast', enabled)
  document.documentElement.dataset.contrast = enabled ? 'high' : 'normal'
}

export function setHighContrast(enabled: boolean) {
  try {
    localStorage.setItem(CONTRAST_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
  applyHighContrast(enabled)
}

export function toggleHighContrast(): boolean {
  const next = !getHighContrast()
  setHighContrast(next)
  return next
}
