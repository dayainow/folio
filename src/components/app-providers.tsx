'use client'

import { useEffect, type ReactNode } from 'react'
import { I18nProvider } from '@/components/i18n-provider'
import { bootstrapTheme } from '@/lib/theme'
import { restoreActivePreset } from '@/lib/theme-presets'

/** 루트 클라이언트 프로바이더 (i18n · 테마) */
export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    const stop = bootstrapTheme()
    restoreActivePreset()
    return stop
  }, [])
  return <I18nProvider>{children}</I18nProvider>
}
