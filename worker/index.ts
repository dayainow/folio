/**
 * Folio custom service worker (push · notification · Background Sync)
 * @ducanh2912/next-pwa customWorkerSrc
 * P61 — rich notification (image · actions · group/thread · vibrate)
 */
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & {
  registration: ServiceWorkerRegistration & {
    sync?: { register: (tag: string) => Promise<void> }
  }
}

const SYNC_TAG = 'folio-sync-queue'

type PushJson = {
  title?: string
  body?: string
  message?: string
  url?: string
  tag?: string
  image?: string
  icon?: string
  actions?: Array<{ action: string; title: string }>
  group?: string
  thread?: string
  renotify?: boolean
  vibrate?: number[]
  silent?: boolean
}

self.addEventListener('push', (event) => {
  let title = 'Folio'
  let body = '새 알림이 있습니다'
  let url = '/'
  let tag = 'folio'
  let image: string | undefined
  let icon = '/icons/icon-192.png'
  let actions: Array<{ action: string; title: string }> = []
  let renotify = false
  let vibrate: number[] | undefined
  let silent = false
  let group: string | undefined
  let thread: string | undefined

  try {
    const raw = event.data?.json() as PushJson | undefined
    if (raw) {
      title = raw.title ?? title
      body = raw.body ?? raw.message ?? body
      url = raw.url ?? url
      tag = raw.tag ?? (raw.thread ? `folio-thread-${raw.thread}` : raw.group ? `folio-${raw.group}` : tag)
      image = raw.image
      icon = raw.icon ?? icon
      actions = Array.isArray(raw.actions) ? raw.actions.slice(0, 2) : []
      renotify = Boolean(raw.renotify)
      vibrate = raw.vibrate
      silent = Boolean(raw.silent)
      group = raw.group
      thread = raw.thread
    } else {
      const text = event.data?.text()
      if (text) body = text
    }
  } catch {
    const text = event.data?.text()
    if (text) body = text
  }

  const options: NotificationOptions & {
    image?: string
    renotify?: boolean
    vibrate?: number[]
    actions?: Array<{ action: string; title: string }>
  } = {
    body,
    icon,
    badge: '/icons/icon-192.png',
    tag,
    renotify,
    silent,
    data: { url, group, thread, actions },
  }
  if (image) options.image = image
  if (vibrate?.length) options.vibrate = vibrate
  if (actions.length) options.actions = actions

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  const data = (event.notification.data ?? {}) as {
    url?: string
    actions?: Array<{ action: string; title: string }>
  }
  const action = (event as NotificationEvent).action
  event.notification.close()

  let target = data.url || '/'
  if (action === 'dismiss') return
  if (action === 'open' || action === 'view') target = data.url || '/'
  if (action === 'reply') target = (data.url || '/') + (String(data.url || '').includes('?') ? '&' : '?') + 'compose=1'

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client && target) {
            try {
              await (client as WindowClient).navigate(target)
            } catch {
              /* ignore */
            }
          }
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})

self.addEventListener('sync', (event) => {
  const syncEvent = event as Event & { tag: string; waitUntil: (p: Promise<unknown>) => void }
  if (syncEvent.tag !== SYNC_TAG) return
  syncEvent.waitUntil(notifyClientsToFlush())
})

self.addEventListener('periodicsync', (event) => {
  const pe = event as Event & { tag: string; waitUntil: (p: Promise<unknown>) => void }
  if (pe.tag !== 'folio-periodic-sync') return
  pe.waitUntil(notifyClientsToFlush())
})

async function notifyClientsToFlush() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clients) {
    client.postMessage({ type: 'folio-background-sync', tag: SYNC_TAG })
  }
  if (clients.length === 0) {
    await self.registration.showNotification('Folio 동기화', {
      body: '네트워크가 복구되었습니다. Folio를 열어 오프라인 변경을 동기화하세요.',
      icon: '/icons/icon-192.png',
      data: { url: '/' },
      tag: 'folio-sync',
      actions: [
        { action: 'open', title: '열기' },
        { action: 'dismiss', title: '닫기' },
      ],
    } as NotificationOptions)
  }
}

export {}
