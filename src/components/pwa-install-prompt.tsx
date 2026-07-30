'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Bell, BellOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getPushConsent,
  requestPushSubscription,
  setPushConsent,
  subscribePushConsent,
  unsubscribePush,
  type PushConsent,
} from '@/lib/push-notifications'
import { cn } from '@/lib/utils'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const INSTALL_DISMISS_KEY = 'folio_pwa_install_dismissed'

/** PWA 설치 안내 + 푸시 알림 동의 — hydrate 전에는 렌더하지 않아 CLS 방지 */
export function PwaInstallPrompt() {
  const deferred = useRef<BeforeInstallPromptEvent | null>(null)
  const [ready, setReady] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [dismissed, setDismissed] = useState(true)
  const [consent, setConsent] = useState<PushConsent>('unknown')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDismissed(localStorage.getItem(INSTALL_DISMISS_KEY) === '1')
      setConsent(getPushConsent())
      setReady(true)
    }, 0)

    const onBip = (e: Event) => {
      e.preventDefault()
      deferred.current = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    const unsub = subscribePushConsent(setConsent)

    return () => {
      window.clearTimeout(handle)
      window.removeEventListener('beforeinstallprompt', onBip)
      unsub()
    }
  }, [])

  // 아직 결정하지 않은 경우(default)에만 푸시 안내 — unknown/granted/denied는 배너로 밀지 않음
  const showInstall = ready && canInstall && !dismissed
  const showPush = ready && consent === 'default'

  if (!showInstall && !showPush) return null

  return (
    <div
      role="region"
      aria-label="앱 설치 및 알림"
      className="mb-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-card px-4 py-3 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {showInstall && (
            <>
              <p className="text-sm font-medium tracking-tight">홈 화면에 추가</p>
              <p className="text-[11px] text-muted-foreground">
                Folio를 앱처럼 설치하면 오프라인에서도 일지·문서를 열 수 있습니다.
              </p>
            </>
          )}
          {showPush && (
            <>
              <p className={cn('text-sm font-medium tracking-tight', showInstall && 'mt-2')}>
                푸시 알림
              </p>
              <p className="text-[11px] text-muted-foreground">
                저장 완료 · 팀 초대 · Gate 변경을 브라우저 알림으로 받습니다. (동의 필요)
              </p>
            </>
          )}
          {pushMsg && <p className="text-[11px] text-muted-foreground">{pushMsg}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showInstall && (
            <Button
              type="button"
              size="sm"
              className="h-11 min-h-[44px] gap-1.5 text-xs"
              onClick={() => {
                void (async () => {
                  const ev = deferred.current
                  if (!ev) return
                  await ev.prompt()
                  await ev.userChoice
                  deferred.current = null
                  setCanInstall(false)
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
          {showInstall && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-11 w-11 min-h-[44px] min-w-[44px]"
              aria-label="설치 안내 닫기"
              onClick={() => {
                localStorage.setItem(INSTALL_DISMISS_KEY, '1')
                setDismissed(true)
                setPushConsent(getPushConsent())
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
