/**
 * Folio custom service worker (push · notification · Background Sync)
 * @ducanh2912/next-pwa customWorkerSrc
 */
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & {
  registration: ServiceWorkerRegistration & {
    sync?: { register: (tag: string) => Promise<void> }
  }
}

const SYNC_TAG = 'folio-sync-queue'

self.addEventListener('push', (event) => {
  let title = 'Folio'
  let body = '새 알림이 있습니다'
  let url = '/'
  try {
    const raw = event.data?.json() as
      | { title?: string; body?: string; url?: string; message?: string }
      | undefined
    if (raw) {
      title = raw.title ?? title
      body = raw.body ?? raw.message ?? body
      url = raw.url ?? url
    } else {
      const text = event.data?.text()
      if (text) body = text
    }
  } catch {
    const text = event.data?.text()
    if (text) body = text
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data as { url?: string } | undefined)?.url || '/'
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

/** P42 — Background Sync: 클라이언트가 큐를 flush 하도록 메시지 */
self.addEventListener('sync', (event) => {
  const syncEvent = event as Event & { tag: string; waitUntil: (p: Promise<unknown>) => void }
  if (syncEvent.tag !== SYNC_TAG) return
  syncEvent.waitUntil(notifyClientsToFlush())
})

/** P57 — Periodic Background Sync */
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
    })
  }
}

export {}
