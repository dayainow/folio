/**
 * P55 — 컨텍스트 도움말 팁 (사이드바/헤더)
 */
'use client'

import { useId, useState } from 'react'
import { CircleHelp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEscapeToClose } from '@/lib/a11y'
import { useI18n } from '@/components/i18n-provider'
import { cn } from '@/lib/utils'

const TIPS = [
  'help.tipSearch',
  'help.tipSave',
  'help.tipTheme',
  'help.tipGuide',
  'help.tipKeyboard',
] as const

export function HelpTipsButton({ className }: { className?: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const titleId = useId()
  useEscapeToClose(open, () => setOpen(false))

  return (
    <div className={cn('relative', className)}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 gap-1 px-2 text-[11px]"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <CircleHelp className="size-3.5" aria-hidden />
        {t('help.tips')}
      </Button>
      {open ? (
        <div
          role="dialog"
          aria-labelledby={titleId}
          className="absolute bottom-full left-0 z-50 mb-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-border bg-background p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 id={titleId} className="text-xs font-semibold">
              {t('help.title')}
            </h3>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => setOpen(false)}
              aria-label={t('common.close')}
            >
              <X className="size-3.5" />
            </Button>
          </div>
          <ul className="space-y-2 text-[11px] leading-snug text-muted-foreground">
            {TIPS.map((key) => (
              <li key={key} className="flex gap-1.5">
                <span aria-hidden className="text-teal-600">
                  •
                </span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
