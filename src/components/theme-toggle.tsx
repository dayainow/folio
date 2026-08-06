'use client'

import { useEffect, useState } from 'react'
import { Contrast, Monitor, Moon, Palette, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/components/i18n-provider'
import { announceToScreenReader } from '@/lib/a11y'
import {
  cycleThemePreference,
  getHighContrast,
  getStoredThemePreference,
  toggleHighContrast,
  type ThemePreference,
} from '@/lib/theme'
import { ThemeSettingsPanel } from '@/components/theme-panel'

/** P55/P65 — 테마 순환(Light/Dark/System) + 고대비 + 설정 */
export function ThemeToggle() {
  const { t } = useI18n()
  const [pref, setPref] = useState<ThemePreference>(() =>
    typeof window !== 'undefined' ? getStoredThemePreference() : 'light',
  )
  const [contrast, setContrast] = useState(
    () => (typeof window !== 'undefined' ? getHighContrast() : false),
  )
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    const sync = () => {
      setPref(getStoredThemePreference())
      setContrast(getHighContrast())
    }
    const openPanel = () => setPanelOpen(true)
    window.addEventListener('storage', sync)
    window.addEventListener('folio:open-theme-settings', openPanel)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('folio:open-theme-settings', openPanel)
    }
  }, [])

  const onCycleTheme = () => {
    const next = cycleThemePreference()
    setPref(next)
    const label =
      next === 'dark'
        ? t('settings.themeDark')
        : next === 'light'
          ? t('settings.themeLight')
          : '시스템 테마'
    announceToScreenReader(label)
  }

  const onToggleContrast = () => {
    const next = toggleHighContrast()
    setContrast(next)
    announceToScreenReader(next ? t('settings.contrastOn') : t('settings.contrastOff'))
  }

  const themeLabel =
    pref === 'dark' ? '다크' : pref === 'system' ? '시스템' : '라이트'
  const contrastLabel = contrast ? t('settings.contrastOff') : t('settings.contrastOn')

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="min-h-11 min-w-11"
        onClick={onCycleTheme}
        aria-label={`테마: ${themeLabel} (클릭하여 전환)`}
        title={`테마: ${themeLabel}`}
      >
        {pref === 'dark' ? (
          <Moon className="h-4 w-4" />
        ) : pref === 'system' ? (
          <Monitor className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </Button>
      <Button
        type="button"
        size="icon"
        variant={contrast ? 'default' : 'outline'}
        className="min-h-11 min-w-11"
        onClick={onToggleContrast}
        aria-label={contrastLabel}
        aria-pressed={contrast}
        title={contrastLabel}
      >
        <Contrast className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="min-h-11 min-w-11"
        onClick={() => setPanelOpen(true)}
        aria-label="테마 설정"
        title="테마 설정"
      >
        <Palette className="h-4 w-4" />
      </Button>
      <ThemeSettingsPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  )
}
