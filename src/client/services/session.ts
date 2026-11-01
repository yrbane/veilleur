/**
 * Veilleur - Session côté client : jetons d'accès et de rafraîchissement.
 * Un seul rafraîchissement à la fois (le serveur fait tourner le jeton : deux appels
 * parallèles avec le même jeton déconnecteraient), jetons partagés entre onglets,
 * déconnexion uniquement sur refus définitif du serveur, jamais sur une panne réseau.
 */

const CLE_ACCESS = 'accessToken';
const CLE_REFRESH = 'refreshToken';
const API_BASE = '/api/v1';

let accessToken: string | null = lire(CLE_ACCESS);
let refreshToken: string | null = lire(CLE_REFRESH);
let onDeconnexionCallback: (() => void) | null = null;
let rafraichissementEnCours: Promise<boolean> | null = null;

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeur: string | null): void {
  try {
    if (valeur === null) localStorage.removeItem(cle);
    else localStorage.setItem(cle, valeur);
  } catch {
    // Stockage indisponible (navigation privée stricte) : la session vit en mémoire
  }
}

/** Définit le callback appelé lors d'une déconnexion automatique */
export function setOnDeconnexion(callback: () => void): void {
  onDeconnexionCallback = callback;
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  ecrire(CLE_ACCESS, access);
  ecrire(CLE_REFRESH, refresh);
}

export function clearTokens(notifier = false): void {
  accessToken = null;
  refreshToken = null;
  ecrire(CLE_ACCESS, null);
  ecrire(CLE_REFRESH, null);
  if (notifier && onDeconnexionCallback) onDeconnexionCallback();
}

export function estAuthentifie(): boolean {
  return accessToken !== null;
}

export function obtenirAccessToken(): string | null {
  return accessToken;
}

export function obtenirRefreshToken(): string | null {
  return refreshToken;
}

/** Date d'expiration (secondes Unix) lue dans la charge utile du JWT, sans vérifier la signature */
function lireExpiration(jeton: string): number | null {
  const corps = jeton.split('.')[1];
  if (!corps) return null;
  try {
    const json = atob(corps.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/** Vrai si le jeton est absent, illisible, ou expire dans moins de `margeSecondes` */
export function jetonExpire(jeton: string | null, margeSecondes = 30): boolean {
  if (!jeton) return true;
  const exp = lireExpiration(jeton);
  if (exp === null) return true;
  return exp - margeSecondes <= Date.now() / 1000;
}

/** Un autre onglet a-t-il déjà fait tourner le jeton ? Si oui on adopte ses jetons. */
function adopterJetonsStockes(jetonEssaye: string): boolean {
  const refreshStocke = lire(CLE_REFRESH);
  const accessStocke = lire(CLE_ACCESS);
  if (refreshStocke && accessStocke && refreshStocke !== jetonEssaye) {
    accessToken = accessStocke;
    refreshToken = refreshStocke;
    return true;
  }
  return false;
}

/**
 * Rafraîchit les jetons. Les appels concurrents partagent la même promesse.
 * Retourne vrai si la session est utilisable après l'appel.
 */
export function rafraichirSession(): Promise<boolean> {
  if (rafraichissementEnCours) return rafraichissementEnCours;
  rafraichissementEnCours = executerRafraichissement().finally(() => {
    rafraichissementEnCours = null;
  });
  return rafraichissementEnCours;
}

async function executerRafraichissement(): Promise<boolean> {
  const jeton = refreshToken ?? lire(CLE_REFRESH);
  if (!jeton) return false;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/auth/rafraichir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: jeton }),
    });
  } catch {
    // Réseau absent : on garde les jetons, la prochaine requête retentera
    return false;
  }
  if (response.ok) {
    const data = (await response.json().catch(() => null)) as { accessToken?: string; refreshToken?: string } | null;
    if (data?.accessToken && data.refreshToken) {
      setTokens(data.accessToken, data.refreshToken);
      return true;
    }
    return false;
  }
  if (response.status === 401 || response.status === 403) {
    if (adopterJetonsStockes(jeton)) return true;
    clearTokens(true);
    return false;
  }
  // 5xx ou autre : le serveur a un souci, pas la session
  return false;
}

/**
 * À appeler avant la première requête d'une page : si le jeton d'accès est périmé,
 * un seul rafraîchissement a lieu avant que les requêtes ne partent en parallèle.
 */
export async function preparerSession(): Promise<void> {
  if (!refreshToken) return;
  if (jetonExpire(accessToken)) await rafraichirSession();
}

// Jetons écrits par un autre onglet (connexion, rotation, déconnexion) : on les suit
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== CLE_ACCESS && e.key !== CLE_REFRESH && e.key !== null) return;
    accessToken = lire(CLE_ACCESS);
    refreshToken = lire(CLE_REFRESH);
  });
}
