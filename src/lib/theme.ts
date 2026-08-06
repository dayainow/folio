/**
 * P55/P65 — 테마 · 고대비 · 외형(접근성) 설정
 */
'use client'

const THEME_KEY = 'folio_theme'
const CONTRAST_KEY = 'folio_high_contrast'
const APPEARANCE_KEY = 'folio_appearance_v1'

/** 사용자 선택 (system = OS 따라감) */
export type ThemePreference = 'light' | 'dark' | 'system'
/** 실제 적용된 모드 */
export type ThemeMode = 'light' | 'dark'

export type FontScale = 'sm' | 'md' | 'lg' | 'xl'
export type ReduceMotionPref = 'system' | 'reduce' | 'no-preference'

export type AppearancePrefs = {
  fontScale: FontScale
  boldText: boolean
  strongFocus: boolean
  reduceMotion: ReduceMotionPref
  /** 활성 커스텀 프리셋 id (없으면 null) */
  activePresetId: string | null
}

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  fontScale: 'md',
  boldText: false,
  strongFocus: false,
  reduceMotion: 'system',
  activePresetId: null,
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'light'
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'dark' || v === 'light' || v === 'system') return v
    return 'light'
  } catch {
    return 'light'
  }
}

/** @deprecated P55 호환 — preference가 system이면 실효 모드 */
export function getStoredTheme(): ThemeMode {
  return resolveEffectiveTheme(getStoredThemePreference())
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

export function resolveEffectiveTheme(pref: ThemePreference = getStoredThemePreference()): ThemeMode {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return pref
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', mode === 'dark')
  root.dataset.theme = mode
  root.style.colorScheme = mode
}

/** 전환 애니메이션 한 번 적용 */
export function withThemeTransition(fn: () => void) {
  if (typeof document === 'undefined') {
    fn()
    return
  }
  const root = document.documentElement
  const reduce =
    root.classList.contains('folio-reduce-motion') ||
    (typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      !root.classList.contains('folio-allow-motion'))
  if (reduce) {
    fn()
    return
  }
  root.classList.add('theme-animating')
  fn()
  window.setTimeout(() => root.classList.remove('theme-animating'), 280)
}

export function setStoredThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(THEME_KEY, pref)
  } catch {
    /* ignore */
  }
  withThemeTransition(() => applyTheme(resolveEffectiveTheme(pref)))
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.themePref = pref
  }
}

/** P55 호환 — light/dark만 저장 */
export function setStoredTheme(mode: ThemeMode) {
  setStoredThemePreference(mode)
}

export function toggleTheme(): ThemeMode {
  const pref = getStoredThemePreference()
  const effective = resolveEffectiveTheme(pref)
  const next: ThemeMode = effective === 'dark' ? 'light' : 'dark'
  setStoredThemePreference(next)
  return next
}

/** light → dark → system → light */
export function cycleThemePreference(): ThemePreference {
  const cur = getStoredThemePreference()
  const next: ThemePreference =
    cur === 'light' ? 'dark' : cur === 'dark' ? 'system' : 'light'
  setStoredThemePreference(next)
  return next
}

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
  withThemeTransition(() => applyHighContrast(enabled))
}

export function toggleHighContrast(): boolean {
  const next = !getHighContrast()
  setHighContrast(next)
  return next
}

export function loadAppearance(): AppearancePrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE }
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY)
    if (!raw) return { ...DEFAULT_APPEARANCE }
    const parsed = JSON.parse(raw) as Partial<AppearancePrefs>
    return {
      fontScale: parsed.fontScale ?? DEFAULT_APPEARANCE.fontScale,
      boldText: Boolean(parsed.boldText),
      strongFocus: Boolean(parsed.strongFocus),
      reduceMotion: parsed.reduceMotion ?? DEFAULT_APPEARANCE.reduceMotion,
      activePresetId: parsed.activePresetId ?? null,
    }
  } catch {
    return { ...DEFAULT_APPEARANCE }
  }
}

export function applyAppearance(prefs: AppearancePrefs) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.fontScale = prefs.fontScale
  root.classList.toggle('folio-bold-text', prefs.boldText)
  root.classList.toggle('folio-strong-focus', prefs.strongFocus)
  root.classList.remove('folio-reduce-motion', 'folio-allow-motion')
  if (prefs.reduceMotion === 'reduce') root.classList.add('folio-reduce-motion')
  if (prefs.reduceMotion === 'no-preference') root.classList.add('folio-allow-motion')
}

export function saveAppearance(prefs: AppearancePrefs) {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
  applyAppearance(prefs)
}

/** 부트스트랩: 테마·고대비·외형 일괄 적용 + system 리스너 */
export function bootstrapTheme() {
  if (typeof window === 'undefined') return () => {}
  const pref = getStoredThemePreference()
  applyTheme(resolveEffectiveTheme(pref))
  document.documentElement.dataset.themePref = pref
  applyHighContrast(getHighContrast())
  applyAppearance(loadAppearance())

  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (getStoredThemePreference() === 'system') {
      withThemeTransition(() => applyTheme(resolveEffectiveTheme('system')))
    }
  }
  mq.addEventListener?.('change', onChange)
  return () => mq.removeEventListener?.('change', onChange)
}
