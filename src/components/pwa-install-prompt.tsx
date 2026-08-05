'use client'

/**
 * P42/P57 — PWA 설치 안내 · 설치 완료 · 푸시 · 재안내
 */
import { useEffect, useRef, useState } from 'react'
import { Download, Bell, BellOff, X, Share, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getPushConsent,
  requestPushSubscription,
  setPushConsent,
  subscribePushConsent,
  unsubscribePush,
  type PushConsent,
} from '@/lib/push-notifications'
import { hapticSuccess } from '@/lib/haptics'
import { cn } from '@/lib/utils'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const INSTALL_DISMISS_KEY = 'folio_pwa_install_dismissed'
const INSTALL_DISMISS_AT_KEY = 'folio_pwa_install_dismissed_at'
const INSTALLED_KEY = 'folio_pwa_installed'
/** 닫은 뒤 3일 지나면 다시 안내 (P57 — 더 적극적) */
const DISMISS_TTL_MS = 3 * 24 * 60 * 60 * 1000

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/.test(ua)
  const criOS = /CriOS|FxiOS|EdgiOS/.test(ua)
  return iOS && webkit && !criOS
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isDismissFresh(): boolean {
  try {
    if (localStorage.getItem(INSTALL_DISMISS_KEY) !== '1') return false
    const at = Number(localStorage.getItem(INSTALL_DISMISS_AT_KEY) || 0)
    if (!at) return true
    return Date.now() - at < DISMISS_TTL_MS
  } catch {
    return false
  }
}

/** 설정 등에서 설치 안내 다시 보기 */
export function resetPwaInstallPrompt(): void {
  try {
    localStorage.removeItem(INSTALL_DISMISS_KEY)
    localStorage.removeItem(INSTALL_DISMISS_AT_KEY)
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('folio-pwa-reset-prompt'))
  }
}

/** PWA 설치 안내 + 푸시 — P57: appinstalled · 맞춤 카피 · 재안내 */
export function PwaInstallPrompt() {
  const deferred = useRef<BeforeInstallPromptEvent | null>(null)
  const [ready, setReady] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(true)
  const [justInstalled, setJustInstalled] = useState(false)
  const [consent, setConsent] = useState<PushConsent>('unknown')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  useEffect(() => {
    const boot = () => {
      const dismissedFresh = isDismissFresh()
      setDismissed(dismissedFresh)
      setConsent(getPushConsent())
      const standalone = isStandalone()
      const ios = isIosSafari() && !standalone
      setShowIosHint(ios && !dismissedFresh)
      setReady(true)
      if (standalone) {
        try {
          localStorage.setItem(INSTALLED_KEY, '1')
        } catch {
          /* ignore */
        }
      }
    }
    const handle = window.setTimeout(boot, 800)

    const onBip = (e: Event) => {
      e.preventDefault()
      deferred.current = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }
    const onInstalled = () => {
      deferred.current = null
      setCanInstall(false)
      setJustInstalled(true)
      hapticSuccess()
      try {
        localStorage.setItem(INSTALLED_KEY, '1')
      } catch {
        /* ignore */
      }
      window.setTimeout(() => setJustInstalled(false), 6000)
    }
    const onReset = () => {
      setDismissed(false)
      setShowIosHint(isIosSafari() && !isStandalone())
    }

    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('folio-pwa-reset-prompt', onReset)
    const unsub = subscribePushConsent(setConsent)

    return () => {
      window.clearTimeout(handle)
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('folio-pwa-reset-prompt', onReset)
      unsub()
      deferred.current = null
    }
  }, [])

  const showInstall = ready && ((canInstall && !dismissed) || showIosHint)
  const showPush = ready && consent === 'default'

  if (!showInstall && !showPush && !justInstalled) return null

  const dismissInstall = () => {
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, '1')
      localStorage.setItem(INSTALL_DISMISS_AT_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
    setDismissed(true)
    setShowIosHint(false)
    setPushConsent(getPushConsent())
  }

  return (
    <div
      role="region"
      aria-label="앱 설치 및 알림"
      className={cn(
        'mb-4 rounded-2xl border border-gray-100 bg-card px-4 py-3 shadow-sm dark:border-gray-800',
        'md:static',
        'max-md:sticky max-md:top-12 max-md:z-40 max-md:mb-3',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {justInstalled && (
            <p className="flex items-center gap-1.5 text-sm font-medium tracking-tight text-teal-700 dark:text-teal-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Folio가 홈 화면에 추가되었습니다
            </p>
          )}
          {showInstall && canInstall && (
            <>
              <p className="text-sm font-medium tracking-tight">앱처럼 빠르게 쓰기</p>
              <p className="text-[11px] text-muted-foreground">
                홈 화면에 설치하면 오프라인 일지·백그라운드 동기화·전체화면을 바로 쓸 수 있습니다.
              </p>
            </>
          )}
          {showInstall && showIosHint && !canInstall && (
            <>
              <p className="text-sm font-medium tracking-tight">iPhone에 설치</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Safari 하단 <Share className="mx-0.5 inline h-3 w-3" aria-hidden /> 공유 →{' '}
                <strong>홈 화면에 추가</strong>를 선택하세요.
              </p>
            </>
          )}
          {showPush && (
            <>
              <p className={cn('text-sm font-medium tracking-tight', showInstall && 'mt-2')}>
                푸시 알림
              </p>
              <p className="text-[11px] text-muted-foreground">
                저장 완료 · 동기화 복구 · Gate 변경을 알림으로 받습니다.
              </p>
            </>
          )}
          {pushMsg && <p className="text-[11px] text-muted-foreground">{pushMsg}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showInstall && canInstall && (
            <Button
              type="button"
              size="sm"
              className="h-11 min-h-[44px] gap-1.5 text-xs"
              onClick={() => {
                void (async () => {
                  const ev = deferred.current
                  if (!ev) return
                  await ev.prompt()
                  const choice = await ev.userChoice
                  deferred.current = null
                  setCanInstall(false)
                  if (choice.outcome === 'accepted') {
                    setJustInstalled(true)
                    hapticSuccess()
                  }
                })()
              }}
            >
              <Download className="h-3.5 w-3.5" />
              설치
            </Button>
          )}
          {showPush && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11 min-h-[44px] gap-1.5 text-xs"
              disabled={pushBusy}
              onClick={() => {
                setPushBusy(true)
                setPushMsg(null)
                void requestPushSubscription()
                  .then((r) => {
                    setPushMsg(r.ok ? '알림이 켜졌습니다.' : r.message ?? '알림을 켤 수 없습니다.')
                    setConsent(getPushConsent())
                  })
                  .finally(() => setPushBusy(false))
              }}
            >
              <Bell className="h-3.5 w-3.5" />
              알림 허용
            </Button>
          )}
          {consent === 'granted' && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-11 min-h-[44px] gap-1.5 text-xs"
              onClick={() => {
                void unsubscribePush().then(() => {
                  setConsent('denied')
                  setPushMsg('알림을 껐습니다.')
                })
              }}
            >
              <BellOff className="h-3.5 w-3.5" />
              알림 끄기
            </Button>
          )}
          {(showInstall || justInstalled) && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-11 w-11 min-h-[44px] min-w-[44px]"
              aria-label="설치 안내 닫기"
              onClick={() => {
                dismissInstall()
                setJustInstalled(false)
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
