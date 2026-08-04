'use client'

import type { ReactNode } from 'react'
import { I18nProvider } from '@/components/i18n-provider'

/** 루트 클라이언트 프로바이더 (i18n 등) */
export function AppProviders({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>
}
