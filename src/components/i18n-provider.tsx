'use client'

/**
 * P53 — i18n React context · useI18n
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  applyDocumentLocale,
  DEFAULT_LOCALE,
  LOCALE_EVENT,
  resolveLocale,
  setLocale as persistLocale,
  translate,
  type Locale,
} from '@/lib/i18n'

type Params = Record<string, string | number>

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Params) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    const next = resolveLocale()
    applyDocumentLocale(next)
    const handle = window.setTimeout(() => setLocaleState(next), 0)
    return () => window.clearTimeout(handle)
  }, [])

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ locale: Locale }>).detail
      if (detail?.locale) setLocaleState(detail.locale)
    }
    window.addEventListener(LOCALE_EVENT, onChange)
    return () => window.removeEventListener(LOCALE_EVENT, onChange)
  }, [])

  const setLocale = useCallback((next: Locale) => {
    persistLocale(next)
    setLocaleState(next)
  }, [])

  const t = useCallback(
    (key: string, params?: Params) => translate(key, params, locale),
    [locale],
  )

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    return {
      locale: 'ko',
      setLocale: persistLocale,
      t: (key, params) => translate(key, params, 'ko'),
    }
  }
  return ctx
}
