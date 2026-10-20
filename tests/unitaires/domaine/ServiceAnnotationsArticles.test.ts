/**
 * Veilleur - Tests du service d'annotations d'articles (note et tags par utilisateur)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceAnnotationsArticles } from '@/domaine/services/ServiceAnnotationsArticles';

describe('ServiceAnnotationsArticles', () => {
  const depotAnnotations = {
    noter: vi.fn(),
    definirFavori: vi.fn(),
    definirTags: vi.fn(),
    obtenirAnnotations: vi.fn(),
    listerTagsUtilises: vi.fn(),
  };
  const depotArticles = { trouverParId: vi.fn() };
  const depotTags = { trouverOuCreer: vi.fn() };
  const serviceCache = { supprimerPattern: vi.fn() };

  const creerService = () =>
    new ServiceAnnotationsArticles(depotAnnotations, depotArticles, depotTags, serviceCache as never);

  beforeEach(() => {
    vi.clearAllMocks();
    depotArticles.trouverParId.mockResolvedValue({ id: 'art-1', titre: 'Un article' });
    depotTags.trouverOuCreer.mockImplementation(async (nom: string) => ({
      id: `tag-${nom.toLowerCase()}`,
      nom,
      slug: nom.toLowerCase(),
      dateCreation: new Date(),
    }));
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

  describe('definirTags', () => {
    it('crée ou retrouve chaque tag, dédoublonne et remplace la liste', async () => {
      const tags = await creerService().definirTags('user-1', 'art-1', [' Écologie ', 'ecologie', 'Politique', '']);

      expect(tags.map(t => t.nom)).toEqual(['Écologie', 'Politique']);
      expect(depotTags.trouverOuCreer).toHaveBeenCalledTimes(2);
      expect(depotAnnotations.definirTags).toHaveBeenCalledWith('user-1', 'art-1', ['tag-écologie', 'tag-politique']);
      expect(serviceCache.supprimerPattern).toHaveBeenCalled();
    });

    it('accepte une liste vide pour tout retirer', async () => {
      const tags = await creerService().definirTags('user-1', 'art-1', []);

      expect(tags).toEqual([]);
      expect(depotAnnotations.definirTags).toHaveBeenCalledWith('user-1', 'art-1', []);
    });

    it('refuse plus de 10 tags', async () => {
      const noms = Array.from({ length: 11 }, (_, i) => `tag${i}`);

      await expect(creerService().definirTags('user-1', 'art-1', noms)).rejects.toMatchObject({ code: 'TROP_DE_TAGS' });
    });

    it('refuse un tag trop long', async () => {
      await expect(creerService().definirTags('user-1', 'art-1', ['x'.repeat(51)])).rejects.toMatchObject({ code: 'TAG_INVALIDE' });
    });

    it('refuse un article inconnu', async () => {
      depotArticles.trouverParId.mockResolvedValue(null);

      await expect(creerService().definirTags('user-1', 'inconnu', ['a'])).rejects.toMatchObject({ code: 'ARTICLE_INTROUVABLE' });
    });
  });

  describe('obtenirAnnotations', () => {
    it('ne consulte pas la base pour une liste vide', async () => {
      const annotations = await creerService().obtenirAnnotations('user-1', []);

      expect(annotations.size).toBe(0);
      expect(depotAnnotations.obtenirAnnotations).not.toHaveBeenCalled();
    });

    it('délègue au dépôt sinon', async () => {
      const attendu = new Map([['art-1', { note: 3, favori: false, tags: [] }]]);
      depotAnnotations.obtenirAnnotations.mockResolvedValue(attendu);

      expect(await creerService().obtenirAnnotations('user-1', ['art-1'])).toBe(attendu);
    });
  });
});
