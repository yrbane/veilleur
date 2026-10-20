/**
 * Veilleur - Tests du service d'annotations d'articles (note et favori par utilisateur)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceAnnotationsArticles } from '@/domaine/services/ServiceAnnotationsArticles';

describe('ServiceAnnotationsArticles', () => {
  const depotAnnotations = {
    noter: vi.fn(),
    definirFavori: vi.fn(),
    obtenirAnnotations: vi.fn(),
    marquerLu: vi.fn(),
    definirALire: vi.fn(),
    listerAnnotations: vi.fn(),
  };
  const depotArticles = { trouverParId: vi.fn(), marquerTousLus: vi.fn(), compterNonLus: vi.fn() };
  const serviceCache = { supprimerPattern: vi.fn() };

  const creerService = () =>
    new ServiceAnnotationsArticles(depotAnnotations, depotArticles, serviceCache as never);

  beforeEach(() => {
    vi.clearAllMocks();
    depotArticles.trouverParId.mockResolvedValue({ id: 'art-1', titre: 'Un article' });
    serviceCache.supprimerPattern.mockResolvedValue(0);
  });

  describe('noter', () => {
    it('enregistre une note valide et invalide le cache du fil', async () => {
      const resultat = await creerService().noter('user-1', 'art-1', 4);

      expect(resultat).toEqual({ note: 4 });
      expect(depotAnnotations.noter).toHaveBeenCalledWith('user-1', 'art-1', 4);
      expect(serviceCache.supprimerPattern).toHaveBeenCalledWith(expect.stringContaining('user-1'));
    });

    it('retire la note avec null', async () => {
      const resultat = await creerService().noter('user-1', 'art-1', null);

      expect(resultat).toEqual({ note: null });
      expect(depotAnnotations.noter).toHaveBeenCalledWith('user-1', 'art-1', null);
    });

    it('refuse une note hors de 1 à 5', async () => {
      await expect(creerService().noter('user-1', 'art-1', 7)).rejects.toMatchObject({ code: 'NOTE_INVALIDE' });
      await expect(creerService().noter('user-1', 'art-1', 2.5)).rejects.toMatchObject({ code: 'NOTE_INVALIDE' });
      expect(depotAnnotations.noter).not.toHaveBeenCalled();
    });

    it('refuse un article inconnu', async () => {
      depotArticles.trouverParId.mockResolvedValue(null);

      await expect(creerService().noter('user-1', 'inconnu', 3)).rejects.toMatchObject({ code: 'ARTICLE_INTROUVABLE' });
    });
  });

  describe('definirFavori', () => {
    it('met en favori, puis retire, en invalidant le cache du fil', async () => {
      expect(await creerService().definirFavori('user-1', 'art-1', true)).toEqual({ favori: true });
      expect(depotAnnotations.definirFavori).toHaveBeenCalledWith('user-1', 'art-1', true);

      expect(await creerService().definirFavori('user-1', 'art-1', false)).toEqual({ favori: false });
      expect(serviceCache.supprimerPattern).toHaveBeenCalledTimes(2);
    });

    it('refuse un article inconnu', async () => {
      depotArticles.trouverParId.mockResolvedValue(null);

      await expect(creerService().definirFavori('user-1', 'inconnu', true)).rejects.toMatchObject({ code: 'ARTICLE_INTROUVABLE' });
    });
  });

  describe('obtenirAnnotations', () => {
    it('ne consulte pas la base pour une liste vide', async () => {
      const annotations = await creerService().obtenirAnnotations('user-1', []);

      expect(annotations.size).toBe(0);
      expect(depotAnnotations.obtenirAnnotations).not.toHaveBeenCalled();
    });

    it('délègue au dépôt sinon', async () => {
      const attendu = new Map([['art-1', { note: 3, favori: false }]]);
      depotAnnotations.obtenirAnnotations.mockResolvedValue(attendu);

      expect(await creerService().obtenirAnnotations('user-1', ['art-1'])).toBe(attendu);
    });
  });

  describe('marquerLu', () => {
    it('marque un article lu puis non lu, en invalidant le cache du fil', async () => {
      const service = creerService();

      expect(await service.marquerLu('u1', 'art-1', true)).toEqual({ lu: true });
      expect(depotAnnotations.marquerLu).toHaveBeenCalledWith('u1', 'art-1', true);
      expect(await service.marquerLu('u1', 'art-1', false)).toEqual({ lu: false });
      expect(serviceCache.supprimerPattern).toHaveBeenCalledWith('articles:fil:u1:*');
    });

    it('refuse un article inconnu', async () => {
      depotArticles.trouverParId.mockResolvedValue(null);

      await expect(creerService().marquerLu('u1', 'inconnu', true)).rejects.toMatchObject({ code: 'ARTICLE_INTROUVABLE' });
      expect(depotAnnotations.marquerLu).not.toHaveBeenCalled();
    });
  });

  describe('marquerTousLus', () => {
    it('marque lus les articles du fil publiés avant l\'instant demandé et renvoie le nombre', async () => {
      depotArticles.marquerTousLus.mockResolvedValue(12);
      const avant = new Date('2026-10-20T10:00:00Z');

      const resultat = await creerService().marquerTousLus('u1', { sourceId: 'src-1', avant });

      expect(resultat).toEqual({ marques: 12 });
      expect(depotArticles.marquerTousLus).toHaveBeenCalledWith('u1', { sourceId: 'src-1', avant });
      expect(serviceCache.supprimerPattern).toHaveBeenCalledWith('articles:fil:u1:*');
    });

    it('prend « maintenant » comme borne par défaut', async () => {
      depotArticles.marquerTousLus.mockResolvedValue(0);
      const debut = Date.now();

      await creerService().marquerTousLus('u1', {});

      const options = depotArticles.marquerTousLus.mock.calls[0][1] as { avant: Date; sourceId?: string };
      expect(options.sourceId).toBeUndefined();
      expect(options.avant.getTime()).toBeGreaterThanOrEqual(debut);
    });
  });

  describe('compterNonLus', () => {
    it('délègue au dépôt des articles', async () => {
      depotArticles.compterNonLus.mockResolvedValue({ total: 3, parSource: { 'src-1': 3 }, parTag: { actu: 3 } });

      expect(await creerService().compterNonLus('u1')).toEqual({ total: 3, parSource: { 'src-1': 3 }, parTag: { actu: 3 } });
    });
  });

  describe('definirALire', () => {
    it('met l\'article dans la liste de lecture et invalide le fil', async () => {
      expect(await creerService().definirALire('u1', 'art-1', true)).toEqual({ aLire: true });
      expect(depotAnnotations.definirALire).toHaveBeenCalledWith('u1', 'art-1', true);
      expect(serviceCache.supprimerPattern).toHaveBeenCalledWith('articles:fil:u1:*');
    });

    it('refuse un article inconnu', async () => {
      depotArticles.trouverParId.mockResolvedValue(null);
      await expect(creerService().definirALire('u1', 'x', true)).rejects.toMatchObject({ code: 'ARTICLE_INTROUVABLE' });
    });
  });

  describe('exporterAnnotations', () => {
    const annotation = {
      articleId: 'art-1', titre: 'Un; titre', lien: 'https://j.fr/a', source: 'Journal',
      datePublication: new Date('2026-10-20T10:00:00Z'), note: 4, favori: true, aLire: false, lu: true,
      dateMiseAJour: new Date('2026-10-21T08:00:00Z'),
    };

    it('produit un JSON daté avec les annotations', async () => {
      depotAnnotations.listerAnnotations.mockResolvedValue([annotation]);

      const exportation = await creerService().exporterAnnotations('u1', 'json', new Date('2026-10-21T09:00:00Z'));

      expect(exportation.nomFichier).toBe('veilleur-annotations-2026-10-21.json');
      expect(exportation.typeMime).toContain('application/json');
      const corps = JSON.parse(exportation.contenu);
      expect(corps.nombre).toBe(1);
      expect(corps.annotations[0]).toMatchObject({ titre: 'Un; titre', note: 4, favori: true, lu: true });
    });

    it('produit un CSV avec en-tête et champs cités', async () => {
      depotAnnotations.listerAnnotations.mockResolvedValue([annotation]);

      const exportation = await creerService().exporterAnnotations('u1', 'csv', new Date('2026-10-21T09:00:00Z'));

      expect(exportation.nomFichier).toBe('veilleur-annotations-2026-10-21.csv');
      expect(exportation.typeMime).toContain('text/csv');
      const lignes = exportation.contenu.replace('\uFEFF', '').trim().split('\r\n');
      expect(lignes[0]).toBe('titre;lien;source;datePublication;note;favori;aLire;lu;dateMiseAJour');
      expect(lignes[1]).toBe('"Un; titre";https://j.fr/a;Journal;2026-10-20T10:00:00.000Z;4;true;false;true;2026-10-21T08:00:00.000Z');
    });
  });
});
