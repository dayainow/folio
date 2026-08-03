/**
 * 브라우저 푸시 · 로컬 Notification (P26)
 * VAPID 미설정 시 Notification API만 사용
 */
'use client'

import { csrfHeaders } from '@/lib/csrf'

const CONSENT_KEY = 'folio_push_consent'
const SUB_KEY = 'folio_push_subscription'

export type PushConsent = 'unknown' | 'granted' | 'denied' | 'default'

export function getPushConsent(): PushConsent {
  if (typeof window === 'undefined') return 'unknown'
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (raw === 'granted' || raw === 'denied' || raw === 'default') return raw
  } catch {
    /* ignore */
  }
  if (!('Notification' in window)) return 'denied'
  return Notification.permission as PushConsent
}

export function setPushConsent(value: PushConsent): void {
  try {
    localStorage.setItem(CONSENT_KEY, value)
    window.dispatchEvent(new CustomEvent('folio-push-consent', { detail: value }))
  } catch {
    /* ignore */
  }
}

export function subscribePushConsent(listener: (v: PushConsent) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onCustom = (e: Event) => listener((e as CustomEvent<PushConsent>).detail)
  window.addEventListener('folio-push-consent', onCustom)
  return () => window.removeEventListener('folio-push-consent', onCustom)
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

/** 사용자 동의 후 Notification + (가능하면) Push 구독 */
export async function requestPushSubscription(): Promise<{
  ok: boolean
  permission: NotificationPermission | 'unsupported'
  subscription: PushSubscriptionJSON | null
  message?: string
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { ok: false, permission: 'unsupported', subscription: null, message: '이 브라우저는 알림을 지원하지 않습니다.' }
  }

  const permission = await Notification.requestPermission()
  setPushConsent(permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'default')
  if (permission !== 'granted') {
    return { ok: false, permission, subscription: null, message: '알림 권한이 거부되었습니다.' }
  }

  const reg = await getRegistration()
  let subscription: PushSubscriptionJSON | null = null

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  if (reg && 'pushManager' in reg && vapid) {
    try {
      const existing = await reg.pushManager.getSubscription()
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
        }))
      subscription = sub.toJSON()
      try {
        localStorage.setItem(SUB_KEY, JSON.stringify(subscription))
      } catch {
        /* ignore */
      }
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ subscription }),
      }).catch(() => undefined)
    } catch {
      /* VAPID/구독 실패해도 로컬 Notification은 가능 */
    }
  }

  return { ok: true, permission, subscription }
}

export async function unsubscribePush(): Promise<void> {
  setPushConsent('denied')
  const reg = await getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  await sub?.unsubscribe().catch(() => undefined)
  try {
    localStorage.removeItem(SUB_KEY)
  } catch {
    /* ignore */
  }
}

export type FolioPushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

/** 동의된 경우 로컬/SW 알림 표시 (+ 서버 푸시 시도) */
export async function showFolioPush(payload: FolioPushPayload): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (getPushConsent() === 'denied') return

  const reg = await getRegistration()
  const options: NotificationOptions = {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag ?? 'folio',
    data: { url: payload.url ?? '/' },
  }

  try {
    if (reg?.showNotification) {
      await reg.showNotification(payload.title, options)
    } else {
      new Notification(payload.title, options)
    }
  } catch {
    try {
      new Notification(payload.title, options)
    } catch {
      /* ignore */
    }
  }

  // 서버 Web Push (구독·VAPID 있을 때)
  void fetch('/api/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: JSON.stringify(payload),
  }).catch(() => undefined)
}
