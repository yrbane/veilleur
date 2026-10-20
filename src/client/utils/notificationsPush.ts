/**
 * Veilleur - Abonnement Web Push côté navigateur
 */

export interface AbonnementPushJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Clé VAPID base64url → octets attendus par pushManager.subscribe
 */
export function decoderClePublique(base64url: string): Uint8Array {
  const remplissage = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + remplissage).replace(/-/g, '+').replace(/_/g, '/');
  const brut = atob(base64);
  return Uint8Array.from(brut, c => c.charCodeAt(0));
}

export function pushSupporte(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function enregistrerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const existant = await navigator.serviceWorker.getRegistration('/');
    return existant ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
  } catch {
    return null;
  }
}

export async function abonnementCourant(): Promise<PushSubscription | null> {
  if (!pushSupporte()) return null;
  const inscription = await enregistrerServiceWorker();
  return inscription ? inscription.pushManager.getSubscription() : null;
}

/**
 * Demande la permission puis crée l'abonnement ; renvoie son JSON à transmettre au serveur
 */
export async function abonnerPush(clePublique: string): Promise<AbonnementPushJson> {
  const inscription = await enregistrerServiceWorker();
  if (!inscription) throw new Error('Service worker indisponible');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission refusée');
  await navigator.serviceWorker.ready;
  const abonnement =
    (await inscription.pushManager.getSubscription()) ??
    (await inscription.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decoderClePublique(clePublique) as BufferSource }));
  const json = abonnement.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Abonnement incomplet');
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

/** Retire l'abonnement du navigateur ; renvoie l'endpoint retiré, ou null s'il n'y en avait pas */
export async function desabonnerPush(): Promise<string | null> {
  const abonnement = await abonnementCourant();
  if (!abonnement) return null;
  await abonnement.unsubscribe();
  return abonnement.endpoint;
}
