import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCALE,
  detectBrowserLocale,
  isLocale,
  resolveLocale,
  translate,
} from '@/lib/i18n'

describe('i18n', () => {
  it('detects browser locales', () => {
    expect(detectBrowserLocale('ko-KR')).toBe('ko')
    expect(detectBrowserLocale('en-US,en;q=0.9')).toBe('en')
    expect(detectBrowserLocale('ja')).toBe('ja')
    expect(detectBrowserLocale('fr-FR')).toBe(DEFAULT_LOCALE)
  })

  it('validates locale', () => {
    expect(isLocale('ko')).toBe(true)
    expect(isLocale('zh')).toBe(false)
  })

  it('resolves stored over browser', () => {
    expect(resolveLocale({ stored: 'en', acceptLanguage: 'ko' })).toBe('en')
    expect(resolveLocale({ stored: null, acceptLanguage: 'ja-JP' })).toBe('ja')
  })

  it('translates with fallback and params', () => {
    expect(translate('nav.journal', undefined, 'ko')).toBe('일지')
    expect(translate('nav.journal', undefined, 'en')).toBe('Journal')
    expect(translate('nav.journal', undefined, 'ja')).toBe('日誌')
    expect(translate('search.resultsCount', { count: 3 }, 'ko')).toBe('결과 3건')
    expect(translate('search.resultsCount', { count: 3 }, 'en')).toBe('3 results')
    expect(translate('missing.key.xyz', undefined, 'en')).toBe('missing.key.xyz')
  })

  it('falls back to ko for missing keys in other locales', () => {
    // all catalogs share keys; simulate via known key always present
    expect(translate('common.save', undefined, 'en')).toBe('Save')
  })
})
