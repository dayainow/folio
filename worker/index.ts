/**
 * Folio custom service worker additions (push · notification click)
 * @ducanh2912/next-pwa customWorkerSrc
 */
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope

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

export {}
