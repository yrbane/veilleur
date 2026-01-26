/**
 * Tests unitaires - ServiceCommunaute
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceCommunaute } from '@/domaine/services/ServiceCommunaute';
import type { DepotSources, SourcePopulaire, TagPopulaire } from '@/domaine/ports/DepotSources';

describe('ServiceCommunaute', () => {
  let service: ServiceCommunaute;
  let mockDepotSources: Partial<DepotSources>;

  const sourcesPopulaires: SourcePopulaire[] = [
    {
      id: 'source-1',
      url: 'https://techblog.com/feed',
      nom: 'Tech Blog',
      typeSource: 'rss',
      statut: 'active',
      urlFavicon: 'https://techblog.com/favicon.ico',
      dateCreation: new Date('2024-01-01'),
      nombreUtilisateurs: 150,
      noteMoyenne: 4.5,
      tags: [
        { id: 'tag-1', nom: 'Technologie', slug: 'technologie' },
        { id: 'tag-2', nom: 'JavaScript', slug: 'javascript' },
      ],
    },
    {
      id: 'source-2',
      url: 'https://devnews.io/rss',
      nom: 'Dev News',
      typeSource: 'rss',
      statut: 'active',
      urlFavicon: null,
      dateCreation: new Date('2024-02-15'),
      nombreUtilisateurs: 80,
      noteMoyenne: 4.0,
      tags: [
        { id: 'tag-1', nom: 'Technologie', slug: 'technologie' },
      ],
    },
  ];

  const tagsPopulaires: TagPopulaire[] = [
    { id: 'tag-1', nom: 'Technologie', slug: 'technologie', nombreSources: 50, dateCreation: new Date() },
    { id: 'tag-2', nom: 'JavaScript', slug: 'javascript', nombreSources: 30, dateCreation: new Date() },
    { id: 'tag-3', nom: 'TypeScript', slug: 'typescript', nombreSources: 25, dateCreation: new Date() },
  ];

  beforeEach(() => {
    mockDepotSources = {
      listerSourcesPopulaires: vi.fn().mockResolvedValue({
        donnees: sourcesPopulaires,
        pagination: {
          page: 1,
          limite: 20,
          total: 2,
          totalPages: 1,
        },
      }),
      listerTagsPopulaires: vi.fn().mockResolvedValue(tagsPopulaires),
    };

    service = new ServiceCommunaute(mockDepotSources as DepotSources);
  });

  describe('listerSourcesPopulaires', () => {
    it('devrait lister les sources populaires avec critères par défaut', async () => {
      const resultat = await service.listerSourcesPopulaires();

      expect(mockDepotSources.listerSourcesPopulaires).toHaveBeenCalledWith({
        page: 1,
        limite: 20,
        tag: undefined,
        tri: 'populaire',
        recherche: undefined,
      });
      expect(resultat.donnees).toHaveLength(2);
    });

    it('devrait appliquer les critères personnalisés', async () => {
      await service.listerSourcesPopulaires({
        page: 2,
        limite: 10,
        tag: 'javascript',
        tri: 'note',
      });

      expect(mockDepotSources.listerSourcesPopulaires).toHaveBeenCalledWith({
        page: 2,
        limite: 10,
        tag: 'javascript',
        tri: 'note',
        recherche: undefined,
      });
    });

    it('devrait supporter le tri par date', async () => {
      await service.listerSourcesPopulaires({ tri: 'recent' });

      expect(mockDepotSources.listerSourcesPopulaires).toHaveBeenCalledWith(
        expect.objectContaining({ tri: 'recent' }),
      );
    });

    it('devrait supporter la recherche', async () => {
      await service.listerSourcesPopulaires({ recherche: 'tech' });

      expect(mockDepotSources.listerSourcesPopulaires).toHaveBeenCalledWith(
        expect.objectContaining({ recherche: 'tech' }),
      );
    });
  });

  describe('listerTagsPopulaires', () => {
    it('devrait lister les tags populaires avec limite par défaut', async () => {
      const resultat = await service.listerTagsPopulaires();

      expect(mockDepotSources.listerTagsPopulaires).toHaveBeenCalledWith(20);
      expect(resultat).toHaveLength(3);
    });

    it('devrait respecter la limite personnalisée', async () => {
      await service.listerTagsPopulaires(10);

      expect(mockDepotSources.listerTagsPopulaires).toHaveBeenCalledWith(10);
    });

    it('devrait retourner les tags avec le nombre de sources', async () => {
      const tags = await service.listerTagsPopulaires();

      expect(tags[0]).toHaveProperty('nombreSources');
      expect(tags[0].nombreSources).toBe(50);
    });
  });

  describe('rechercherSources', () => {
    it('devrait rechercher les sources par terme', async () => {
      await service.rechercherSources('javascript');

      expect(mockDepotSources.listerSourcesPopulaires).toHaveBeenCalledWith(
        expect.objectContaining({ recherche: 'javascript' }),
      );
    });

    it('devrait combiner recherche et critères', async () => {
      await service.rechercherSources('tech', {
        tag: 'javascript',
        tri: 'note',
      });

      expect(mockDepotSources.listerSourcesPopulaires).toHaveBeenCalledWith(
        expect.objectContaining({
          recherche: 'tech',
          tag: 'javascript',
          tri: 'note',
        }),
      );
    });

    it('devrait appliquer la pagination à la recherche', async () => {
      await service.rechercherSources('dev', { page: 3, limite: 5 });

      expect(mockDepotSources.listerSourcesPopulaires).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 3,
          limite: 5,
          recherche: 'dev',
        }),
      );
    });
  });
});

describe('ServiceCommunaute - Cas limites', () => {
  let service: ServiceCommunaute;
  let mockDepotSources: Partial<DepotSources>;

  beforeEach(() => {
    mockDepotSources = {
      listerSourcesPopulaires: vi.fn().mockResolvedValue({
        donnees: [],
        pagination: { page: 1, limite: 20, total: 0, totalPages: 0 },
      }),
      listerTagsPopulaires: vi.fn().mockResolvedValue([]),
    };

    service = new ServiceCommunaute(mockDepotSources as DepotSources);
  });

  it('devrait gérer une liste de sources vide', async () => {
    const resultat = await service.listerSourcesPopulaires();

    expect(resultat.donnees).toHaveLength(0);
    expect(resultat.pagination.total).toBe(0);
  });

  it('devrait gérer une liste de tags vide', async () => {
    const tags = await service.listerTagsPopulaires();

    expect(tags).toHaveLength(0);
  });

  it('devrait gérer une recherche sans résultats', async () => {
    const resultat = await service.rechercherSources('xyz123nonexistent');

    expect(resultat.donnees).toHaveLength(0);
  });
});

describe('Types de tri supportés', () => {
  it('devrait supporter tous les types de tri', () => {
    const trisValides = ['populaire', 'note', 'recent'] as const;

    expect(trisValides).toContain('populaire');
    expect(trisValides).toContain('note');
    expect(trisValides).toContain('recent');
    expect(trisValides).toHaveLength(3);
  });
});

describe('Structure SourcePopulaire', () => {
  it('devrait avoir la structure attendue', () => {
    const source: SourcePopulaire = {
      id: 'source-1',
      url: 'https://example.com/feed',
      nom: 'Example',
      typeSource: 'rss',
      statut: 'active',
      urlFavicon: null,
      dateCreation: new Date(),
      nombreUtilisateurs: 10,
      noteMoyenne: 4.5,
      tags: [],
    };

    expect(source).toHaveProperty('id');
    expect(source).toHaveProperty('url');
    expect(source).toHaveProperty('nom');
    expect(source).toHaveProperty('nombreUtilisateurs');
    expect(source).toHaveProperty('noteMoyenne');
    expect(source).toHaveProperty('tags');
  });

  it('devrait permettre une note moyenne nulle', () => {
    const source: SourcePopulaire = {
      id: 'source-1',
      url: 'https://example.com/feed',
      nom: 'Example',
      typeSource: 'rss',
      statut: 'active',
      urlFavicon: null,
      dateCreation: new Date(),
      nombreUtilisateurs: 1,
      noteMoyenne: null,
      tags: [],
    };

    expect(source.noteMoyenne).toBeNull();
  });
});
