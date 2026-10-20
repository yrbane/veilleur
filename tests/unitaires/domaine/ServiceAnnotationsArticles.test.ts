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
  };
  const depotArticles = { trouverParId: vi.fn() };
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
});
