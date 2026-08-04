'use client'

/**
 * P53 — 헤더 언어 전환 토글 (ko / en / ja)
 */
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/components/i18n-provider'
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()

  const cycle = () => {
    const idx = SUPPORTED_LOCALES.indexOf(locale)
    const next = SUPPORTED_LOCALES[(idx + 1) % SUPPORTED_LOCALES.length] as Locale
    setLocale(next)
  }

  return (
    <div className={cn('inline-flex items-center gap-0.5', className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1 px-2 text-xs text-muted-foreground"
        onClick={cycle}
        aria-label={t('lang.switch')}
        title={`${t('lang.label')}: ${t(`lang.${locale}`)}`}
      >
        <Languages className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline uppercase tracking-wide">{locale}</span>
      </Button>
      <div
        role="group"
        aria-label={t('lang.label')}
        className="hidden items-center rounded-md border border-transparent sm:flex"
      >
        {SUPPORTED_LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={locale === code}
            className={cn(
              'h-7 rounded px-1.5 text-[10px] font-medium uppercase transition-colors',
              locale === code
                ? 'bg-gray-100 text-foreground dark:bg-gray-800'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title={t(`lang.${code}`)}
          >
            {code}
          </button>
        ))}
      </div>
    </div>
  )
}
