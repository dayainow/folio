/**
 * P65 — 커스텀 테마 프리셋 저장/공유
 */
'use client'

import { loadAppearance, saveAppearance } from '@/lib/theme'

export type ThemePreset = {
  id: string
  name: string
  /** hex e.g. #0f172a */
  primary: string
  accent: string
  background?: string
  fontFamily: 'geist' | 'serif' | 'mono'
  fontScale: 'sm' | 'md' | 'lg' | 'xl'
  createdAt: string
  updatedAt: string
}

const PRESETS_KEY = 'folio_theme_presets_v1'

export const BUILTIN_PRESETS: ThemePreset[] = [
  {
    id: 'builtin-slate',
    name: 'Slate',
    primary: '#0f172a',
    accent: '#334155',
    fontFamily: 'geist',
    fontScale: 'md',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'builtin-teal',
    name: 'Teal',
    primary: '#0f766e',
    accent: '#14b8a6',
    fontFamily: 'geist',
    fontScale: 'md',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'builtin-ink',
    name: 'Ink Serif',
    primary: '#1c1917',
    accent: '#78716c',
    fontFamily: 'serif',
    fontScale: 'lg',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

function isBuiltin(id: string) {
  return id.startsWith('builtin-')
}

export function loadCustomPresets(): ThemePreset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ThemePreset[]
    return Array.isArray(parsed) ? parsed.filter((p) => p?.id && p?.name) : []
  } catch {
    return []
  }
}

export function saveCustomPresets(list: ThemePreset[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(list.slice(0, 30)))
  } catch {
    /* ignore */
  }
}

export function listThemePresets(): ThemePreset[] {
  return [...BUILTIN_PRESETS, ...loadCustomPresets()]
}

export function upsertThemePreset(preset: ThemePreset): ThemePreset[] {
  if (isBuiltin(preset.id)) throw new Error('builtin_readonly')
  const customs = loadCustomPresets()
  const i = customs.findIndex((p) => p.id === preset.id)
  const next = { ...preset, updatedAt: new Date().toISOString() }
  if (i >= 0) customs[i] = next
  else customs.unshift(next)
  saveCustomPresets(customs)
  return listThemePresets()
}

export function deleteThemePreset(id: string): ThemePreset[] {
  if (isBuiltin(id)) return listThemePresets()
  saveCustomPresets(loadCustomPresets().filter((p) => p.id !== id))
  const appearance = loadAppearance()
  if (appearance.activePresetId === id) {
    clearPresetCssVars()
    saveAppearance({ ...appearance, activePresetId: null })
  }
  return listThemePresets()
}

export function createThemePreset(input: {
  name: string
  primary: string
  accent: string
  fontFamily?: ThemePreset['fontFamily']
  fontScale?: ThemePreset['fontScale']
}): ThemePreset {
  const now = new Date().toISOString()
  const preset: ThemePreset = {
    id: crypto.randomUUID(),
    name: input.name.trim() || '커스텀',
    primary: input.primary,
    accent: input.accent,
    fontFamily: input.fontFamily ?? 'geist',
    fontScale: input.fontScale ?? 'md',
    createdAt: now,
    updatedAt: now,
  }
  upsertThemePreset(preset)
  return preset
}

function clearPresetCssVars() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.removeProperty('--folio-custom-primary')
  root.style.removeProperty('--folio-custom-accent')
  root.classList.remove('folio-custom-theme')
  root.dataset.fontFamily = 'geist'
}

export function applyThemePreset(preset: ThemePreset | null) {
  if (typeof document === 'undefined') return
  const appearance = loadAppearance()
  if (!preset) {
    clearPresetCssVars()
    saveAppearance({ ...appearance, activePresetId: null })
    return
  }
  const root = document.documentElement
  root.classList.add('folio-custom-theme')
  root.style.setProperty('--folio-custom-primary', preset.primary)
  root.style.setProperty('--folio-custom-accent', preset.accent)
  root.dataset.fontFamily = preset.fontFamily
  saveAppearance({
    ...appearance,
    fontScale: preset.fontScale,
    activePresetId: preset.id,
  })
}

export function exportPresetJson(preset: ThemePreset): string {
  return JSON.stringify(
    {
      type: 'folio-theme-preset',
      version: 1,
      preset: {
        name: preset.name,
        primary: preset.primary,
        accent: preset.accent,
        fontFamily: preset.fontFamily,
        fontScale: preset.fontScale,
      },
    },
    null,
    2,
  )
}

export function importPresetJson(raw: string): ThemePreset {
  const data = JSON.parse(raw) as {
    type?: string
    preset?: Partial<ThemePreset>
    name?: string
    primary?: string
    accent?: string
    fontFamily?: ThemePreset['fontFamily']
    fontScale?: ThemePreset['fontScale']
  }
  const src: Partial<ThemePreset> = data.preset ?? {
    name: data.name,
    primary: data.primary,
    accent: data.accent,
    fontFamily: data.fontFamily,
    fontScale: data.fontScale,
  }
  if (!src.primary || !src.name) throw new Error('invalid_preset')
  return createThemePreset({
    name: String(src.name),
    primary: String(src.primary),
    accent: String(src.accent ?? src.primary),
    fontFamily: src.fontFamily ?? 'geist',
    fontScale: src.fontScale ?? 'md',
  })
}

/** 부트 시 활성 프리셋 복원 */
export function restoreActivePreset() {
  const appearance = loadAppearance()
  if (!appearance.activePresetId) return
  const found = listThemePresets().find((p) => p.id === appearance.activePresetId)
  if (found) applyThemePreset(found)
  else clearPresetCssVars()
}
