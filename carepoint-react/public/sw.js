// Service worker for staff phone alerts.
// The browser keeps this small script and wakes it when the server sends a push,
// even when no tab of the site is open. It only shows the alert and opens the
// staff page when tapped; it does not cache pages or work offline.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'New order'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Open the staff page to see it.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.orderId ? `order-${data.orderId}` : 'new-order', // one alert per order
      requireInteraction: true, // stays on screen until tapped (where the phone allows it)
      vibrate: [300, 120, 300, 120, 600],
      data: { url: data.url || '/staff' },
    }),
  )
})

// Tapping the alert brings an open staff tab to the front, or opens a new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/staff', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
      const staffTab = tabs.find((t) => new URL(t.url).pathname.startsWith('/staff'))
      if (staffTab) return staffTab.focus()
      return self.clients.openWindow(url)
    }),
  )
})
