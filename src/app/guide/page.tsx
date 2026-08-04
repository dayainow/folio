import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { GuideView } from '@/components/guide-view'
import { loadGuideDocs, resolveDocsLocale } from '@/lib/docs-locale'
import { translate } from '@/lib/i18n'

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const locale = resolveDocsLocale(cookieStore.get('folio_locale')?.value)
  return {
    title: translate('guide.title', undefined, locale),
    description: translate('guide.description', undefined, locale),
  }
}

export default async function GuidePage() {
  const cookieStore = await cookies()
  const locale = resolveDocsLocale(cookieStore.get('folio_locale')?.value)
  const docs = await loadGuideDocs(locale)

  return (
    <GuideView
      docs={{
        onboarding: docs.onboarding,
        features: docs.features,
        troubleshooting: docs.troubleshooting,
      }}
      locale={locale}
    />
  )
}
