/**
 * Veilleur - Rotation tolérante des refresh tokens : un jeton tout juste tourné
 * reste accepté quelques secondes (requêtes parallèles d'un même client),
 * mais un jeton révoqué par déconnexion ou trop ancien est refusé.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as jose from 'jose';

vi.mock('@/infrastructure/cache/blacklistJwt', () => ({ ajouterABlacklist: vi.fn(), estDansBlacklist: vi.fn().mockResolvedValue(false) }));
vi.mock('@/infrastructure/cache/verrouillageCompte', () => ({ verifierVerrouillage: vi.fn(), enregistrerEchec: vi.fn(), reinitialiserTentatives: vi.fn() }));

import { ServiceAuthentification, GRACE_ROTATION_MS } from '@/domaine/services/ServiceAuthentification';
import type { DepotRefreshTokens, DepotUtilisateurs, InfoRefreshToken } from '@/domaine/ports/DepotUtilisateurs';
import { env } from '@/config/environnement';

const utilisateur = { id: 'u1', email: 'a@b.fr', motDePasseHash: 'x', estActif: true, role: 'membre', dateCreation: new Date(), preferences: {} };

function creerDepots() {
  const jetons = new Map<string, InfoRefreshToken>();
  const depotRefresh: DepotRefreshTokens = {
    creer: vi.fn(async (utilisateurId, token, dateExpiration) => { jetons.set(token, { utilisateurId, estRevoque: false, dateExpiration, dateRotation: null }); }),
    trouverTokenValide: vi.fn(async (token) => { const j = jetons.get(token); return j && !j.estRevoque ? { utilisateurId: j.utilisateurId } : null; }),
    trouverParToken: vi.fn(async (token) => jetons.get(token) ?? null),
    marquerRotation: vi.fn(async (token) => { const j = jetons.get(token); if (j) { j.estRevoque = true; j.dateRotation = new Date(); } return !!j; }),
    revoquer: vi.fn(async (token) => { const j = jetons.get(token); if (j) j.estRevoque = true; return !!j; }),
    revoquerTousTokensUtilisateur: vi.fn(async () => { let n = 0; jetons.forEach(j => { if (!j.estRevoque) { j.estRevoque = true; n++; } }); return n; }),
    supprimerTokensExpires: vi.fn(async () => 0),
  } as unknown as DepotRefreshTokens;
  const depotUtilisateurs = { trouverParId: vi.fn(async () => utilisateur) } as unknown as DepotUtilisateurs;
  return { jetons, depotRefresh, depotUtilisateurs };
}

async function jetonRefresh(jti: string): Promise<string> {
  return new jose.SignJWT({ sub: 'u1', type: 'refresh', jti }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(env.JWT_REFRESH_SECRET));
}

describe('rafraichirTokens : rotation tolérante', () => {
  let service: ServiceAuthentification;
  let depots: ReturnType<typeof creerDepots>;

  beforeEach(() => {
    vi.useRealTimers();
    depots = creerDepots();
    service = new ServiceAuthentification(depots.depotUtilisateurs, depots.depotRefresh);
  });

  it('fait tourner un jeton valide et accepte son rejeu immédiat', async () => {
    depots.jetons.set('j1', { utilisateurId: 'u1', estRevoque: false, dateExpiration: new Date(Date.now() + 3600_000), dateRotation: null });
    const jeton = await jetonRefresh('j1');
    const premier = await service.rafraichirTokens(jeton);
    expect(premier.refreshToken).toBeTruthy();
    expect(depots.jetons.get('j1')?.estRevoque).toBe(true);
    // Deux autres onglets/requêtes arrivent avec le même jeton tout juste tourné
    const [deuxieme, troisieme] = await Promise.all([service.rafraichirTokens(jeton), service.rafraichirTokens(jeton)]);
    expect(deuxieme.accessToken).toBeTruthy();
    expect(troisieme.accessToken).toBeTruthy();
    // Chaque rejeu délivre un jeu neuf sans révoquer celui du premier
    expect([...depots.jetons.values()].filter(j => !j.estRevoque)).toHaveLength(3);
  });

  it('refuse un jeton tourné depuis plus longtemps que la fenêtre de grâce', async () => {
    depots.jetons.set('j2', { utilisateurId: 'u1', estRevoque: true, dateExpiration: new Date(Date.now() + 3600_000), dateRotation: new Date(Date.now() - GRACE_ROTATION_MS - 1000) });
    await expect(service.rafraichirTokens(await jetonRefresh('j2'))).rejects.toMatchObject({ code: 'TOKEN_REVOQUE' });
  });

  it('refuse un jeton révoqué par déconnexion, même récente', async () => {
    depots.jetons.set('j3', { utilisateurId: 'u1', estRevoque: true, dateExpiration: new Date(Date.now() + 3600_000), dateRotation: null });
    await expect(service.rafraichirTokens(await jetonRefresh('j3'))).rejects.toMatchObject({ code: 'TOKEN_REVOQUE' });
  });

  it('refuse un jeton inconnu ou expiré en base', async () => {
    await expect(service.rafraichirTokens(await jetonRefresh('inconnu'))).rejects.toMatchObject({ code: 'TOKEN_REVOQUE' });
    depots.jetons.set('j4', { utilisateurId: 'u1', estRevoque: false, dateExpiration: new Date(Date.now() - 1000), dateRotation: null });
    await expect(service.rafraichirTokens(await jetonRefresh('j4'))).rejects.toMatchObject({ code: 'TOKEN_EXPIRE' });
  });

  it('refuse le rejeu en grâce si le compte a été désactivé entre-temps', async () => {
    depots.jetons.set('j5', { utilisateurId: 'u1', estRevoque: true, dateExpiration: new Date(Date.now() + 3600_000), dateRotation: new Date() });
    (depots.depotUtilisateurs.trouverParId as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...utilisateur, estActif: false });
    await expect(service.rafraichirTokens(await jetonRefresh('j5'))).rejects.toMatchObject({ code: 'COMPTE_INACTIF' });
  });
});
