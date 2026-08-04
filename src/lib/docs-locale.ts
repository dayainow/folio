/**
 * P53 — 마크다운 문서 언어별 경로 해석
 * docs/{locale}/NAME.md → docs/NAME.md (fallback)
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
} from '@/lib/i18n'

export const GUIDE_DOC_NAMES = [
  'ONBOARDING.md',
  'FEATURES.md',
  'TROUBLESHOOTING.md',
  'GETTING-STARTED.md',
  'SEARCH.md',
] as const

export type GuideDocName = (typeof GUIDE_DOC_NAMES)[number]

export function resolveDocsLocale(raw?: string | null): Locale {
  if (isLocale(raw)) return raw
  return DEFAULT_LOCALE
}

export function localizedDocPath(locale: Locale, name: string): string {
  return path.join(process.cwd(), 'docs', locale, name)
}

export function rootDocPath(name: string): string {
  return path.join(process.cwd(), 'docs', name)
}

/** locale 폴더 우선, 없으면 루트 docs, 없으면 한국어 메시지 */
export async function loadLocalizedMarkdown(
  locale: Locale,
  name: string,
): Promise<string> {
  const candidates = [
    localizedDocPath(locale, name),
    ...(locale !== DEFAULT_LOCALE ? [localizedDocPath(DEFAULT_LOCALE, name)] : []),
    rootDocPath(name),
  ]
  for (const filePath of candidates) {
    try {
      return await readFile(filePath, 'utf8')
    } catch {
      /* try next */
    }
  }
  return `# ${name}\n\n(Document not found for locale \`${locale}\`)\n`
}

export async function loadGuideDocs(locale: Locale) {
  const [onboarding, features, troubleshooting] = await Promise.all([
    loadLocalizedMarkdown(locale, 'ONBOARDING.md'),
    loadLocalizedMarkdown(locale, 'FEATURES.md'),
    loadLocalizedMarkdown(locale, 'TROUBLESHOOTING.md'),
  ])
  return { onboarding, features, troubleshooting, locale }
}
