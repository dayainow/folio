/**
 * 첫 방문 웰컴 모달 — 한 번만 표시, 핵심 기능 3가지 소개
 */
'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { BookOpen, CalendarDays, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/components/i18n-provider'
import { useEscapeToClose, useFocusTrap } from '@/lib/a11y'
import { cn } from '@/lib/utils'

export const WELCOME_SEEN_KEY = 'welcome_seen'
/** 이전 온보딩 키 — 이미 본 사용자는 웰컴을 다시 보지 않음 */
const LEGACY_ONBOARDING_KEY = 'folio_onboarding_done_v1'

const EXIT_MS = 200

const FEATURES = [
  { id: 'journal', icon: BookOpen, titleKey: 'welcome.journalTitle', bodyKey: 'welcome.journalBody' },
  { id: 'docs', icon: FileText, titleKey: 'welcome.docsTitle', bodyKey: 'welcome.docsBody' },
  { id: 'board', icon: CalendarDays, titleKey: 'welcome.boardTitle', bodyKey: 'welcome.boardBody' },
] as const

export function hasSeenWelcome(): boolean {
  if (typeof window === 'undefined') return true
  try {
    if (localStorage.getItem(WELCOME_SEEN_KEY) === '1') return true
    if (localStorage.getItem(LEGACY_ONBOARDING_KEY) === '1') {
      localStorage.setItem(WELCOME_SEEN_KEY, '1')
      return true
    }
    return false
  } catch {
    return true
  }
}

export function markWelcomeSeen() {
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function resetWelcomeSeen() {
  try {
    localStorage.removeItem(WELCOME_SEEN_KEY)
  } catch {
    /* ignore */
  }
}

export function WelcomeModal({
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
    return forceOpen || !hasSeenWelcome()
  })
  const [exiting, setExiting] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(true)

  const finishClose = useCallback(() => {
    setOpen(false)
    setExiting(false)
    onDone?.()
  }, [onDone])

  const dismiss = useCallback(
    (opts: { markSeen: boolean }) => {
      if (opts.markSeen) markWelcomeSeen()
      setExiting(true)
      window.setTimeout(finishClose, EXIT_MS)
    },
    [finishClose],
  )

  const closeViaX = useCallback(() => {
    dismiss({ markSeen: dontShowAgain })
  }, [dismiss, dontShowAgain])

  const start = useCallback(() => {
    dismiss({ markSeen: true })
  }, [dismiss])

  useEscapeToClose(open && !exiting, closeViaX)
  useFocusTrap(open, panelRef)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-[80] flex items-stretch justify-center sm:items-center sm:p-4',
        'bg-black/45 backdrop-blur-md',
        exiting ? 'animate-out fade-out duration-200' : 'animate-in fade-in duration-200',
      )}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeViaX()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative flex h-full w-full flex-col overflow-y-auto border-border bg-background shadow-xl outline-none',
          'sm:h-auto sm:max-h-[min(90dvh,36rem)] sm:max-w-md sm:rounded-2xl sm:border',
          'focus-visible:ring-2 focus-visible:ring-ring',
          exiting
            ? 'animate-out fade-out zoom-out-95 duration-200'
            : 'animate-in fade-in zoom-in-95 duration-200',
        )}
      >
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute right-3 top-3 z-10 size-10 min-h-10 min-w-10 rounded-full hover:bg-muted focus-visible:ring-2"
          onClick={closeViaX}
          aria-label={t('common.close')}
        >
          <X className="size-5" aria-hidden />
        </Button>

        <div className="flex flex-1 flex-col px-5 pb-6 pt-14 sm:px-6 sm:pt-12">
          <h2 id={titleId} className="pr-10 text-xl font-semibold tracking-tight sm:text-lg">
            {t('welcome.title')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('welcome.subtitle')}</p>

          <ul className="mt-6 space-y-3">
            {FEATURES.map(({ id, icon: Icon, titleKey, bodyKey }) => (
              <li
                key={id}
                className="flex gap-3 rounded-xl border border-border/80 bg-muted/30 p-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-foreground shadow-sm ring-1 ring-border/60">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t(titleKey)}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t(bodyKey)}</p>
                </div>
              </li>
            ))}
          </ul>

          <label className="mt-6 inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="size-4 rounded border-gray-300"
            />
            {t('welcome.dontShowAgain')}
          </label>

          <div className="mt-auto pt-6 sm:mt-5 sm:pt-0">
            <Button
              type="button"
              className="h-11 min-h-11 w-full gap-2 text-sm font-medium focus-visible:ring-2"
              onClick={start}
            >
              {t('welcome.start')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
