// Nexis service worker — transporte de Web Push apenas.
// Sem cache/offline por decisão de projeto.
// Ver docs/superpowers/specs/2026-09-03-pwa-native-feel-and-install-design.md.
// Offline fica para a futura versão React Native.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? 'Nexis'
  const body = data.body ?? ''
  const url = data.url ?? '/dashboard'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/logo-nexis-fundo.webp',
      badge: '/logo-nexis-fundo.webp',
      vibrate: [200, 100, 200],
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    }),
  )
})
