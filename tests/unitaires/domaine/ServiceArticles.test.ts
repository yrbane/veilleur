/**
 * Veilleur - Tests unitaires pour ServiceArticles
 * Tests de la logique métier de gestion des articles
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ServiceArticles', () => {
  // Mocks des dépôts et services
  const mockDepotArticles = {
    listerFilUtilisateur: vi.fn(),
    trouverParId: vi.fn(),
    creer: vi.fn(),
    creerPlusieurs: vi.fn(),
    articleExiste: vi.fn(),
    listerParSource: vi.fn(),
    compterParSource: vi.fn(),
  };

  const mockDepotSources = {
    trouverParId: vi.fn(),
    listerActives: vi.fn(),
    mettreAJour: vi.fn(),
  };

  const mockServiceCache = {
    obtenir: vi.fn(),
    stocker: vi.fn(),
    supprimer: vi.fn(),
    supprimerPattern: vi.fn(),
    existe: vi.fn(),
    ttl: vi.fn(),
    incrementer: vi.fn(),
    decrementer: vi.fn(),
    obtenirOuStocker: vi.fn(),
    ping: vi.fn(),
    fermer: vi.fn(),
  };

  const mockServiceScraping = {
    extraireArticles: vi.fn(),
    enrichirArticle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceCache.obtenir.mockResolvedValue(null);
    mockServiceCache.stocker.mockResolvedValue(undefined);
  });

  describe('listerFil', () => {
    it('devrait retourner les articles depuis le cache si disponible', async () => {
      const articlesCaches = {
        items: [
          { id: 'article-1', titre: 'Article en cache' },
        ],
        total: 1,
        page: 1,
        limite: 20,
        pages: 1,
      };

      mockServiceCache.obtenir.mockResolvedValue(articlesCaches);

      const { ServiceArticles } = await import('@/domaine/services/ServiceArticles');

      const service = new ServiceArticles(
        mockDepotArticles as never,
        mockDepotSources as never,
        mockServiceCache as never,
        mockServiceScraping as never,
      );

      const resultat = await service.listerFil('user-1');

      expect(resultat).toEqual(articlesCaches);
      expect(mockDepotArticles.listerFilUtilisateur).not.toHaveBeenCalled();
    });

    it('devrait interroger la base si pas en cache', async () => {
      const articlesDb = {
        items: [
          { id: 'article-1', titre: 'Article de la base' },
          { id: 'article-2', titre: 'Autre article' },
        ],
        total: 2,
        page: 1,
        limite: 20,
        pages: 1,
      };

      mockServiceCache.obtenir.mockResolvedValue(null);
      mockDepotArticles.listerFilUtilisateur.mockResolvedValue(articlesDb);

      const { ServiceArticles } = await import('@/domaine/services/ServiceArticles');

      const service = new ServiceArticles(
        mockDepotArticles as never,
        mockDepotSources as never,
        mockServiceCache as never,
        mockServiceScraping as never,
      );

      const resultat = await service.listerFil('user-1');

      expect(resultat.items).toHaveLength(2);
      expect(mockDepotArticles.listerFilUtilisateur).toHaveBeenCalledWith('user-1', undefined);
      expect(mockServiceCache.stocker).toHaveBeenCalled();
    });

    it('devrait passer les critères de filtrage', async () => {
      mockDepotArticles.listerFilUtilisateur.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limite: 10,
        pages: 0,
      });

      const { ServiceArticles } = await import('@/domaine/services/ServiceArticles');

      const service = new ServiceArticles(
        mockDepotArticles as never,
        mockDepotSources as never,
        mockServiceCache as never,
        mockServiceScraping as never,
      );

      const criteres = {
        page: 2,
        limite: 10,
        sourceId: 'source-123',
      };

      await service.listerFil('user-1', criteres);

      expect(mockDepotArticles.listerFilUtilisateur).toHaveBeenCalledWith('user-1', criteres);
    });
  });

  describe('obtenirArticle', () => {
    it('devrait retourner un article par ID', async () => {
      const article = {
        id: 'article-123',
        titre: 'Mon Article',
        lien: 'https://example.com/article',
        datePublication: new Date(),
      };

      mockDepotArticles.trouverParId.mockResolvedValue(article);

      const { ServiceArticles } = await import('@/domaine/services/ServiceArticles');

      const service = new ServiceArticles(
        mockDepotArticles as never,
        mockDepotSources as never,
        mockServiceCache as never,
        mockServiceScraping as never,
      );

      const resultat = await service.obtenirArticle('article-123');

      expect(resultat).toEqual(article);
      expect(mockDepotArticles.trouverParId).toHaveBeenCalledWith('article-123');
    });

    it('devrait retourner null si article inexistant', async () => {
      mockDepotArticles.trouverParId.mockResolvedValue(null);

      const { ServiceArticles } = await import('@/domaine/services/ServiceArticles');

      const service = new ServiceArticles(
        mockDepotArticles as never,
        mockDepotSources as never,
        mockServiceCache as never,
        mockServiceScraping as never,
      );

      const resultat = await service.obtenirArticle('article-unknown');

      expect(resultat).toBeNull();
    });
  });

  describe('synchroniserSource', () => {
    it('devrait synchroniser une source et créer de nouveaux articles', async () => {
      const source = {
        id: 'source-123',
        url: 'https://example.com/feed.rss',
        nom: 'Test Blog',
        typeSource: 'rss',
        statut: 'active',
        nombreEchecs: 0,
      };

      const articlesBruts = [
        { titre: 'Article 1', lien: 'https://example.com/1', datePublication: new Date() },
        { titre: 'Article 2', lien: 'https://example.com/2', datePublication: new Date() },
      ];

      mockDepotSources.trouverParId.mockResolvedValue(source);
      mockServiceScraping.extraireArticles.mockResolvedValue({
        articles: articlesBruts,
        titre: 'Test Blog',
        favicon: null,
        type: 'rss',
      });
      mockDepotArticles.articleExiste.mockResolvedValue(false);
      mockDepotArticles.creer.mockResolvedValue({ id: 'new-1' });

      const { ServiceArticles } = await import('@/domaine/services/ServiceArticles');

      const service = new ServiceArticles(
        mockDepotArticles as never,
        mockDepotSources as never,
        mockServiceCache as never,
        mockServiceScraping as never,
      );

      const resultat = await service.synchroniserSource('source-123');

      expect(resultat.sourceId).toBe('source-123');
      expect(resultat.nouveauxArticles).toBe(2);
      expect(resultat.erreur).toBeUndefined();
    });

    it('devrait ignorer les articles déjà existants (déduplication)', async () => {
      const source = {
        id: 'source-123',
        url: 'https://example.com/feed.rss',
        typeSource: 'rss',
        statut: 'active',
        nombreEchecs: 0,
      };

      const articlesBruts = [
        { titre: 'Article existant', lien: 'https://example.com/existing', datePublication: new Date() },
      ];

      mockDepotSources.trouverParId.mockResolvedValue(source);
      mockServiceScraping.extraireArticles.mockResolvedValue({
        articles: articlesBruts,
        titre: 'Blog',
        favicon: null,
        type: 'rss',
      });
      // L'article existe déjà
      mockDepotArticles.articleExiste.mockResolvedValue(true);

      const { ServiceArticles } = await import('@/domaine/services/ServiceArticles');

      const service = new ServiceArticles(
        mockDepotArticles as never,
        mockDepotSources as never,
        mockServiceCache as never,
        mockServiceScraping as never,
      );

      const resultat = await service.synchroniserSource('source-123');

      expect(resultat.nouveauxArticles).toBe(0);
      expect(resultat.articlesIgnores).toBe(1);
    });

    it('devrait lever une erreur si la source n\'existe pas', async () => {
      mockDepotSources.trouverParId.mockResolvedValue(null);

      const { ServiceArticles, ErreurArticle } = await import('@/domaine/services/ServiceArticles');

      const service = new ServiceArticles(
        mockDepotArticles as never,
        mockDepotSources as never,
        mockServiceCache as never,
        mockServiceScraping as never,
      );

      await expect(service.synchroniserSource('source-unknown')).rejects.toThrow(ErreurArticle);
    });

    it('devrait gérer les erreurs de scraping gracieusement', async () => {
      const source = {
        id: 'source-123',
        url: 'https://example.com/feed.rss',
        typeSource: 'rss',
        statut: 'active',
        nombreEchecs: 0,
      };

      mockDepotSources.trouverParId.mockResolvedValue(source);
      mockServiceScraping.extraireArticles.mockRejectedValue(new Error('Connection refused'));

      const { ServiceArticles } = await import('@/domaine/services/ServiceArticles');

      const service = new ServiceArticles(
        mockDepotArticles as never,
        mockDepotSources as never,
        mockServiceCache as never,
        mockServiceScraping as never,
      );

      const resultat = await service.synchroniserSource('source-123');

      expect(resultat.erreur).toBeDefined();
      expect(resultat.erreur).toContain('Connection refused');
      expect(resultat.nouveauxArticles).toBe(0);
    });
  });

  describe('invalidation du cache', () => {
    it('devrait invalider le cache après synchronisation', async () => {
      const source = {
        id: 'source-123',
        url: 'https://example.com/feed.rss',
        typeSource: 'rss',
        statut: 'active',
        nombreEchecs: 0,
      };

      mockDepotSources.trouverParId.mockResolvedValue(source);
      mockServiceScraping.extraireArticles.mockResolvedValue({
        articles: [],
        titre: 'Blog',
        favicon: null,
        type: 'rss',
      });

      const { ServiceArticles } = await import('@/domaine/services/ServiceArticles');

      const service = new ServiceArticles(
        mockDepotArticles as never,
        mockDepotSources as never,
        mockServiceCache as never,
        mockServiceScraping as never,
      );

      await service.synchroniserSource('source-123');

      // Le cache devrait être invalidé après synchronisation
      expect(mockServiceCache.supprimerPattern).toHaveBeenCalledWith(
        expect.stringContaining('articles:'),
      );
    });
  });
});
