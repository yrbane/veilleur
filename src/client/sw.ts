/// <reference lib="webworker" />
/**
 * Veilleur - Service worker : coque hors ligne, cache des ressources, notifications Web Push
 */

import { NOM_CACHE, PRECACHE, choisirStrategie, cleCacheNavigation } from './sw/strategies';

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(NOM_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((nom) => nom !== NOM_CACHE).map((nom) => caches.delete(nom))))
      .then(() => self.clients.claim()),
  );
});

async function mettreEnCache(requete: Request, reponse: Response): Promise<void> {
  if (reponse.ok && reponse.type === 'basic') {
    const cache = await caches.open(NOM_CACHE);
    await cache.put(requete, reponse.clone());
  }
}

self.addEventListener('fetch', (event) => {
  const strategie = choisirStrategie(event.request, self.location.origin);
  if (strategie === 'ignorer') return;
  if (strategie === 'reseau') {
    event.respondWith(fetch(event.request));
    return;
  }
  if (strategie === 'cache-puis-reseau') {
    event.respondWith(
      caches.match(event.request).then(async (enCache) => {
        if (enCache) return enCache;
        const reponse = await fetch(event.request);
        await mettreEnCache(event.request, reponse);
        return reponse;
      }),
    );
    return;
  }
  // Réseau d'abord ; hors ligne, la coque ou la ressource en cache
  const cle = cleCacheNavigation(event.request, self.location.origin);
  event.respondWith(
    fetch(event.request)
      .then(async (reponse) => {
        await mettreEnCache(new Request(cle), reponse);
        return reponse;
      })
      .catch(async () => (await caches.match(cle)) ?? Response.error()),
  );
});

interface ChargePush {
  titre: string;
  corps: string;
  url: string;
  tag?: string;
}

self.addEventListener('push', (event) => {
  let charge: ChargePush = { titre: 'Veilleur', corps: 'Du nouveau dans vos sources', url: '/' };
  try {
    if (event.data) charge = { ...charge, ...(event.data.json() as Partial<ChargePush>) };
  } catch {
    // Charge non JSON : on garde le texte par défaut
  }
  event.waitUntil(
    self.registration.showNotification(charge.titre, {
      body: charge.corps,
      icon: '/icones/icone-192.png',
      badge: '/icones/icone-192.png',
      tag: charge.tag ?? 'veilleur',
      data: { url: charge.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data as { url?: string } | undefined)?.url ?? '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      const ouverte = fenetres.find((f) => f.url.startsWith(self.location.origin));
      if (ouverte) {
        void ouverte.focus();
        return ouverte.navigate(url);
      }
      return self.clients.openWindow(url);
    }),
  );
});
