/* Veilleur - Service worker : réception des notifications Web Push */
/* global self, URL */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let charge = { titre: 'Veilleur', corps: 'Du nouveau dans vos sources', url: '/' };
  try {
    if (event.data) charge = { ...charge, ...event.data.json() };
  } catch {
    // Charge non JSON : on garde le texte par défaut
  }
  event.waitUntil(
    self.registration.showNotification(charge.titre, {
      body: charge.corps,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: charge.tag || 'veilleur',
      renotify: true,
      data: { url: charge.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      const ouverte = fenetres.find((f) => f.url.startsWith(self.location.origin));
      if (ouverte) {
        ouverte.focus();
        if ('navigate' in ouverte) return ouverte.navigate(url);
        return undefined;
      }
      return self.clients.openWindow(url);
    }),
  );
});
