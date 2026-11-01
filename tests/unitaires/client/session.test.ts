/**
 * Veilleur - Tests de la session client : un seul rafraîchissement à la fois,
 * tolérance aux autres onglets et aux pannes réseau, expiration lue dans le jeton
 */

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

function jwt(exp: number): string {
  const corps = btoa(JSON.stringify({ sub: 'u1', exp })).replace(/=+$/, '');
  return `eyJhbGciOiJIUzI1NiJ9.${corps}.signature`;
}

async function chargerSession() {
  vi.resetModules();
  return import('@/client/services/session');
}

describe('session', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('jetonExpire lit la date d\'expiration du jeton', async () => {
    const { jetonExpire } = await chargerSession();
    const maintenant = Math.floor(Date.now() / 1000);
    expect(jetonExpire(jwt(maintenant - 10))).toBe(true);
    expect(jetonExpire(jwt(maintenant + 3600))).toBe(false);
    // Marge : un jeton qui expire dans 20 s est déjà considéré périmé avec 60 s de marge
    expect(jetonExpire(jwt(maintenant + 20), 60)).toBe(true);
    expect(jetonExpire('n-importe-quoi')).toBe(true);
    expect(jetonExpire(null)).toBe(true);
  });

  it('ne lance qu\'un rafraîchissement pour des appels concurrents', async () => {
    localStorage.setItem('accessToken', jwt(0));
    localStorage.setItem('refreshToken', 'r1');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ accessToken: jwt(9999999999), refreshToken: 'r2' }), { status: 200 }));
    const session = await chargerSession();
    const resultats = await Promise.all([session.rafraichirSession(), session.rafraichirSession(), session.rafraichirSession()]);
    expect(resultats).toEqual([true, true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('refreshToken')).toBe('r2');
    expect(session.estAuthentifie()).toBe(true);
  });

  it('adopte les jetons posés par un autre onglet quand le sien est refusé', async () => {
    localStorage.setItem('accessToken', jwt(0));
    localStorage.setItem('refreshToken', 'r1');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      // Entre-temps, un autre onglet a fait tourner le jeton
      localStorage.setItem('accessToken', jwt(9999999999));
      localStorage.setItem('refreshToken', 'r-autre-onglet');
      return new Response(JSON.stringify({ erreur: 'TOKEN_REVOQUE' }), { status: 401 });
    });
    const session = await chargerSession();
    const deconnexion = vi.fn();
    session.setOnDeconnexion(deconnexion);
    expect(await session.rafraichirSession()).toBe(true);
    expect(session.estAuthentifie()).toBe(true);
    expect(deconnexion).not.toHaveBeenCalled();
  });

  it('déconnecte seulement sur un refus définitif du serveur', async () => {
    localStorage.setItem('accessToken', jwt(0));
    localStorage.setItem('refreshToken', 'r1');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ erreur: 'TOKEN_EXPIRE' }), { status: 401 }));
    const session = await chargerSession();
    const deconnexion = vi.fn();
    session.setOnDeconnexion(deconnexion);
    expect(await session.rafraichirSession()).toBe(false);
    expect(session.estAuthentifie()).toBe(false);
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(deconnexion).toHaveBeenCalledTimes(1);
  });

  it('garde la session en cas de panne réseau ou d\'erreur serveur', async () => {
    localStorage.setItem('accessToken', jwt(0));
    localStorage.setItem('refreshToken', 'r1');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(new Response('', { status: 503 }));
    const session = await chargerSession();
    const deconnexion = vi.fn();
    session.setOnDeconnexion(deconnexion);
    expect(await session.rafraichirSession()).toBe(false);
    expect(await session.rafraichirSession()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(session.estAuthentifie()).toBe(true);
    expect(localStorage.getItem('refreshToken')).toBe('r1');
    expect(deconnexion).not.toHaveBeenCalled();
  });

  it('preparerSession rafraîchit d\'avance un jeton périmé et ne touche pas à un jeton valide', async () => {
    localStorage.setItem('accessToken', jwt(0));
    localStorage.setItem('refreshToken', 'r1');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ accessToken: jwt(9999999999), refreshToken: 'r2' }), { status: 200 }));
    const session = await chargerSession();
    await session.preparerSession();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await session.preparerSession();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('suit les jetons écrits par un autre onglet', async () => {
    const session = await chargerSession();
    expect(session.estAuthentifie()).toBe(false);
    localStorage.setItem('accessToken', jwt(9999999999));
    localStorage.setItem('refreshToken', 'r9');
    window.dispatchEvent(new StorageEvent('storage', { key: 'refreshToken', newValue: 'r9' }));
    expect(session.estAuthentifie()).toBe(true);
    expect(session.obtenirAccessToken()).toBe(jwt(9999999999));
  });
});
