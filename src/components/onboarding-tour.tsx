/**
 * P55 — 첫 방문 온보딩 튜토리얼 (4단계)
 */
'use client'

import { useCallback, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/components/i18n-provider'
import { useEscapeToClose, useFocusTrap } from '@/lib/a11y'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'folio_onboarding_done_v1'

export type OnboardingStep = {
  id: string
  titleKey: string
  bodyKey: string
}

const STEPS: OnboardingStep[] = [
  { id: 'welcome', titleKey: 'onboarding.step1Title', bodyKey: 'onboarding.step1Body' },
  { id: 'write', titleKey: 'onboarding.step2Title', bodyKey: 'onboarding.step2Body' },
  { id: 'search', titleKey: 'onboarding.step3Title', bodyKey: 'onboarding.step3Body' },
  { id: 'a11y', titleKey: 'onboarding.step4Title', bodyKey: 'onboarding.step4Body' },
]

export function isOnboardingDone(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

export function markOnboardingDone() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function resetOnboarding() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function OnboardingTour({
  forceOpen = false,
  onDone,
}: {
  forceOpen?: boolean
  onDone?: () => void
}) {
  const { t } = useI18n()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return forceOpen || !isOnboardingDone()
  })
  const [step, setStep] = useState(0)

  const close = useCallback(() => {
    markOnboardingDone()
    setOpen(false)
    onDone?.()
  }, [onDone])

  useEscapeToClose(open, close)
  useFocusTrap(open, panelRef)

  if (!open) return null

  const current = STEPS[step]!
  const isLast = step >= STEPS.length - 1

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {t('onboarding.progress', { current: step + 1, total: STEPS.length })}
            </p>
            <h2 id={titleId} className="text-base font-semibold">
              {t(current.titleKey)}
            </h2>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={close}
            aria-label={t('common.close')}
          >
            <X className="size-4" />
          </Button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{t(current.bodyKey)}</p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={close}>
            {t('onboarding.skip')}
          </Button>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                {t('onboarding.back')}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (isLast) close()
                else setStep((s) => s + 1)
              }}
            >
              {isLast ? t('onboarding.done') : t('onboarding.next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
