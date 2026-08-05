'use client'

import { useState } from 'react'
import { Contrast, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/components/i18n-provider'
import { announceToScreenReader } from '@/lib/a11y'
import {
  getHighContrast,
  getStoredTheme,
  toggleHighContrast,
  toggleTheme,
  type ThemeMode,
} from '@/lib/theme'

/** P55 — 다크모드 + 고대비 토글 */
export function ThemeToggle() {
  const { t } = useI18n()
  const [mode, setMode] = useState<ThemeMode>(() =>
    typeof window !== 'undefined' ? getStoredTheme() : 'light',
  )
  const [contrast, setContrast] = useState(
    () => (typeof window !== 'undefined' ? getHighContrast() : false),
  )

  const onToggleTheme = () => {
    const next = toggleTheme()
    setMode(next)
    announceToScreenReader(
      next === 'dark' ? t('settings.themeDark') : t('settings.themeLight'),
    )
  }

  const onToggleContrast = () => {
    const next = toggleHighContrast()
    setContrast(next)
    announceToScreenReader(
      next ? t('settings.contrastOn') : t('settings.contrastOff'),
    )
  }

  const themeLabel = mode === 'dark' ? t('settings.themeLight') : t('settings.themeDark')
  const contrastLabel = contrast ? t('settings.contrastOff') : t('settings.contrastOn')

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="min-h-11 min-w-11"
        onClick={onToggleTheme}
        aria-label={themeLabel}
        title={themeLabel}
      >
        {mode === 'dark' ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
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
    </div>
  )
}
