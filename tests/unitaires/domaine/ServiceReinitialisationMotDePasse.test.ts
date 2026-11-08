/**
 * Veilleur - Parcours « Mot de passe oublié » : demande par courriel, lien à usage
 * unique, nouveau mot de passe, révocation des sessions et connexion immédiate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';

vi.mock('@/infrastructure/cache/verrouillageCompte', () => ({ reinitialiserTentatives: vi.fn() }));

import {
  ServiceReinitialisationMotDePasse,
  DUREE_LIEN_MS,
} from '@/domaine/services/ServiceReinitialisationMotDePasse';
import { verifierMotDePasse } from '@/domaine/services/motDePasse';
import type { DemandeReinitialisation, DepotReinitialisationsMotDePasse } from '@/domaine/ports/DepotReinitialisationsMotDePasse';
import type { DepotRefreshTokens, DepotUtilisateurs } from '@/domaine/ports/DepotUtilisateurs';
import type { Courriel, EnvoyeurCourriel } from '@/domaine/ports/EnvoyeurCourriel';
import type { Utilisateur } from '@/domaine/entites/Utilisateur';
import { reinitialiserTentatives } from '@/infrastructure/cache/verrouillageCompte';

function creerUtilisateur(surcharges: Partial<Utilisateur> = {}): Utilisateur {
  return {
    id: 'u1', email: 'marie@example.org', motDePasseHash: 'ancien', dateCreation: new Date(),
    dateDerniereConnexion: null, preferences: {}, estActif: true, role: 'membre', totpSecret: null, totpActif: false,
    ...surcharges,
  };
}

function creerContexte(utilisateur: Utilisateur | null = creerUtilisateur()) {
  const demandes: DemandeReinitialisation[] = [];
  const courriels: Courriel[] = [];
  let configure = true;
  const depotUtilisateurs = {
    trouverParEmail: vi.fn(async (email: string) => (utilisateur && utilisateur.email === email ? utilisateur : null)),
    trouverParId: vi.fn(async (id: string) => (utilisateur && utilisateur.id === id ? utilisateur : null)),
    mettreAJour: vi.fn(async (id: string, donnees: Partial<Utilisateur>) => {
      if (utilisateur && donnees.motDePasseHash) utilisateur.motDePasseHash = donnees.motDePasseHash;
      return utilisateur;
    }),
  } as unknown as DepotUtilisateurs;
  const depotDemandes: DepotReinitialisationsMotDePasse = {
    creer: vi.fn(async (d) => { demandes.push({ ...d, id: `d${demandes.length + 1}`, dateUtilisation: null }); }),
    trouverParTokenHash: vi.fn(async (hash) => demandes.find(d => d.tokenHash === hash) ?? null),
    marquerUtilisee: vi.fn(async (id) => { const d = demandes.find(x => x.id === id); if (d) d.dateUtilisation = new Date(); return !!d; }),
    invaliderPourUtilisateur: vi.fn(async (utilisateurId) => {
      let n = 0;
      demandes.forEach(d => { if (d.utilisateurId === utilisateurId && !d.dateUtilisation) { d.dateUtilisation = new Date(); n++; } });
      return n;
    }),
  };
  const depotRefresh = { revoquerTousTokensUtilisateur: vi.fn(async () => 2) } as unknown as DepotRefreshTokens;
  const envoyeur: EnvoyeurCourriel = {
    estConfigure: () => configure,
    envoyer: vi.fn(async (c: Courriel) => { courriels.push(c); }),
  };
  const emetteur = { emettreTokens: vi.fn(async (u: Utilisateur) => ({ utilisateur: { id: u.id, email: u.email }, accessToken: 'a', refreshToken: 'r', expiresIn: 900 })) };
  const service = new ServiceReinitialisationMotDePasse(depotUtilisateurs, depotDemandes, depotRefresh, envoyeur, emetteur as never, { urlApp: 'https://news.example' });
  return { service, demandes, courriels, depotUtilisateurs, depotDemandes, depotRefresh, envoyeur, emetteur, desactiverCourriel: () => { configure = false; } };
}

function extraireToken(courriel: Courriel): string {
  const m = courriel.texte.match(/token=([A-Za-z0-9_-]+)/);
  if (!m?.[1]) throw new Error('lien absent');
  return m[1];
}

describe('demander', () => {
  beforeEach(() => vi.clearAllMocks());

  it('envoie un lien à usage unique dont seul le hachage est conservé', async () => {
    const ctx = creerContexte();
    await ctx.service.demander('Marie@example.org');
    expect(ctx.courriels).toHaveLength(1);
    expect(ctx.courriels[0]!.a).toBe('marie@example.org');
    const token = extraireToken(ctx.courriels[0]!);
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(ctx.courriels[0]!.texte).toContain('https://news.example/reinitialiser-mot-de-passe?token=');
    expect(ctx.demandes).toHaveLength(1);
    expect(ctx.demandes[0]!.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(ctx.demandes[0]!.utilisateurId).toBe('u1');
    expect(ctx.demandes[0]!.dateExpiration.getTime() - Date.now()).toBeGreaterThan(DUREE_LIEN_MS - 5000);
  });

  it('invalide les demandes précédentes du même compte', async () => {
    const ctx = creerContexte();
    await ctx.service.demander('marie@example.org');
    await ctx.service.demander('marie@example.org');
    expect(ctx.demandes.filter(d => !d.dateUtilisation)).toHaveLength(1);
    expect(ctx.demandes[0]!.dateUtilisation).not.toBeNull();
  });

  it('reste muet pour un courriel inconnu ou un compte désactivé (anti-énumération)', async () => {
    const inconnu = creerContexte(null);
    await expect(inconnu.service.demander('personne@example.org')).resolves.toBeUndefined();
    expect(inconnu.courriels).toHaveLength(0);
    const inactif = creerContexte(creerUtilisateur({ estActif: false }));
    await inactif.service.demander('marie@example.org');
    expect(inactif.courriels).toHaveLength(0);
    expect(inactif.demandes).toHaveLength(0);
  });

  it('ne crée rien quand le courriel n\'est pas configuré', async () => {
    const ctx = creerContexte();
    ctx.desactiverCourriel();
    await ctx.service.demander('marie@example.org');
    expect(ctx.demandes).toHaveLength(0);
    expect(ctx.envoyeur.envoyer).not.toHaveBeenCalled();
  });
});

describe('reinitialiser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('change le mot de passe, révoque les sessions, consomme le lien et connecte', async () => {
    const ctx = creerContexte();
    await ctx.service.demander('marie@example.org');
    const token = extraireToken(ctx.courriels[0]!);

    const resultat = await ctx.service.reinitialiser(token, 'Nouveau!Secret2026');

    expect(resultat.accessToken).toBe('a');
    expect(ctx.emetteur.emettreTokens).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }));
    const utilisateur = await ctx.depotUtilisateurs.trouverParId('u1');
    expect(await verifierMotDePasse('Nouveau!Secret2026', utilisateur!.motDePasseHash)).toBe(true);
    expect(ctx.depotRefresh.revoquerTousTokensUtilisateur).toHaveBeenCalledWith('u1');
    expect(ctx.demandes[0]!.dateUtilisation).not.toBeNull();
    expect(reinitialiserTentatives).toHaveBeenCalledWith('marie@example.org');
    // Le lien ne sert qu'une fois
    await expect(ctx.service.reinitialiser(token, 'Encore!Un2026')).rejects.toMatchObject({ code: 'LIEN_INVALIDE' });
  });

  it('refuse un lien inconnu ou expiré', async () => {
    const ctx = creerContexte();
    await expect(ctx.service.reinitialiser('inconnu', 'Nouveau!Secret2026')).rejects.toMatchObject({ code: 'LIEN_INVALIDE' });
    await ctx.service.demander('marie@example.org');
    ctx.demandes[0]!.dateExpiration = new Date(Date.now() - 1000);
    const token = extraireToken(ctx.courriels[0]!);
    await expect(ctx.service.reinitialiser(token, 'Nouveau!Secret2026')).rejects.toMatchObject({ code: 'LIEN_INVALIDE' });
    expect(ctx.depotUtilisateurs.mettreAJour).not.toHaveBeenCalled();
  });

  it('refuse un mot de passe faible sans consommer le lien', async () => {
    const ctx = creerContexte();
    await ctx.service.demander('marie@example.org');
    const token = extraireToken(ctx.courriels[0]!);
    await expect(ctx.service.reinitialiser(token, 'faible')).rejects.toMatchObject({ code: 'MOT_DE_PASSE_FAIBLE' });
    expect(ctx.demandes[0]!.dateUtilisation).toBeNull();
    await expect(ctx.service.reinitialiser(token, 'Nouveau!Secret2026')).resolves.toBeTruthy();
  });

  it('refuse si le compte a été désactivé entre-temps', async () => {
    const utilisateur = creerUtilisateur();
    const ctx = creerContexte(utilisateur);
    await ctx.service.demander('marie@example.org');
    utilisateur.estActif = false;
    const token = extraireToken(ctx.courriels[0]!);
    await expect(ctx.service.reinitialiser(token, 'Nouveau!Secret2026')).rejects.toMatchObject({ code: 'COMPTE_INACTIF' });
  });
});
