/**
 * P53 — i18n 코어: 로더 · 언어 감지 · fallback (기본 ko)
 */
import ko from '@/locales/ko.json'
import en from '@/locales/en.json'
import ja from '@/locales/ja.json'

export type Locale = 'ko' | 'en' | 'ja'

export const DEFAULT_LOCALE: Locale = 'ko'
export const SUPPORTED_LOCALES: readonly Locale[] = ['ko', 'en', 'ja'] as const

export const LOCALE_STORAGE_KEY = 'folio_locale'
export const LOCALE_COOKIE = 'folio_locale'
export const LOCALE_EVENT = 'folio-locale-change'

type Dict = Record<string, unknown>
type Params = Record<string, string | number>

const catalogs: Record<Locale, Dict> = {
  ko: ko as Dict,
  en: en as Dict,
  ja: ja as Dict,
}

export function isLocale(value: unknown): value is Locale {
  return value === 'ko' || value === 'en' || value === 'ja'
}

/** Accept-Language / navigator.language → 지원 로케일 */
export function detectBrowserLocale(
  acceptLanguage?: string | null,
): Locale {
  const raw =
    acceptLanguage ??
    (typeof navigator !== 'undefined' ? navigator.language || navigator.languages?.[0] : null)
  if (!raw) return DEFAULT_LOCALE
  const primary = raw.split(',')[0]?.trim().toLowerCase() ?? ''
  const base = primary.split('-')[0]
  if (base === 'ko') return 'ko'
  if (base === 'ja') return 'ja'
  if (base === 'en') return 'en'
  return DEFAULT_LOCALE
}

export function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(v) ? v : null
  } catch {
    return null
  }
}

/** 저장값 → 브라우저 → 기본(ko) */
export function resolveLocale(opts?: {
  stored?: string | null
  acceptLanguage?: string | null
}): Locale {
  if (isLocale(opts?.stored)) return opts.stored
  const fromStorage = getStoredLocale()
  if (fromStorage) return fromStorage
  return detectBrowserLocale(opts?.acceptLanguage)
}

function writeCookie(locale: Locale) {
  if (typeof document === 'undefined') return
  const maxAge = 60 * 60 * 24 * 365
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${maxAge};SameSite=Lax`
}

export function applyDocumentLocale(locale: Locale) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
}

export function setLocale(locale: Locale) {
  if (!isLocale(locale)) return
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    }
  } catch {
    /* ignore */
  }
  writeCookie(locale)
  applyDocumentLocale(locale)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(LOCALE_EVENT, { detail: { locale } }),
    )
  }
}

function lookup(dict: Dict, key: string): string | undefined {
  const parts = key.split('.')
  let cur: unknown = dict
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Dict)[p]
  }
  return typeof cur === 'string' ? cur : undefined
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name]
    return v === undefined ? `{${name}}` : String(v)
  })
}

/** 키 조회: locale → fallback(ko) → key 자체 */
export function translate(
  key: string,
  params?: Params,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const primary = lookup(catalogs[locale], key)
  if (primary !== undefined) return interpolate(primary, params)
  if (locale !== DEFAULT_LOCALE) {
    const fallback = lookup(catalogs[DEFAULT_LOCALE], key)
    if (fallback !== undefined) return interpolate(fallback, params)
  }
  return key
}

/** 단축 alias */
export const t = translate

export function getCatalog(locale: Locale): Dict {
  return catalogs[locale] ?? catalogs[DEFAULT_LOCALE]
}

export function listLocales(): Locale[] {
  return [...SUPPORTED_LOCALES]
}
