/**
 * Veilleur - Tests unitaires pour ServiceSources
 * Tests de la logique métier de gestion des sources
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { normaliserUrl } from '@/domaine/entites/Source';

describe('ServiceSources', () => {
  // Mocks des dépôts
  const mockDepotSources = {
    compterSourcesUtilisateur: vi.fn(),
    trouverParHashUrl: vi.fn(),
    utilisateurSuitSource: vi.fn(),
    creer: vi.fn(),
    ajouterPourUtilisateur: vi.fn(),
    retirerPourUtilisateur: vi.fn(),
    listerPourUtilisateur: vi.fn(),
    trouverParId: vi.fn(),
    mettreAJour: vi.fn(),
    basculerPause: vi.fn(),
    noterSource: vi.fn(),
  };

  const mockDepotParametres = {
    obtenirParametres: vi.fn(),
    mettreAJourParametres: vi.fn(),
    supprimerParametres: vi.fn(),
  };

  const mockDetecteurSource = vi.fn();
  const mockDepotTags = {
    trouverOuCreer: vi.fn(async (nom: string) => ({ id: `tag-${nom.toLowerCase()}`, nom, slug: nom.toLowerCase(), dateCreation: new Date() })),
    ajouterTagSource: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Configuration par défaut des mocks
    mockDepotSources.compterSourcesUtilisateur.mockResolvedValue(0);
    mockDepotSources.trouverParHashUrl.mockResolvedValue(null);
    mockDepotSources.utilisateurSuitSource.mockResolvedValue(false);
    mockDetecteurSource.mockResolvedValue({
      type: 'rss',
      titre: 'Test Blog',
      favicon: 'https://example.com/favicon.ico',
    });
  });

  describe('ajouterSource', () => {
    it('pose automatiquement le favicon et les tags déduits à la détection', async () => {
      mockDetecteurSource.mockResolvedValue({ url: 'https://journal.fr/feed', type: 'rss', titre: 'Journal', favicon: 'https://journal.fr/icone.png', tags: ['Politique', 'Écologie'] });
      mockDepotSources.creer.mockImplementation(async (donnees: Record<string, unknown>) => ({ id: 'src-1', ...donnees }));
      mockDepotSources.ajouterPourUtilisateur.mockResolvedValue({ id: 'us-1', sourceId: 'src-1', nom: 'Journal', tags: [] });
      const { ServiceSources } = await import('@/domaine/services/ServiceSources');
      const service = new ServiceSources(mockDepotSources as never, mockDepotParametres as never, mockDetecteurSource, undefined, mockDepotTags);

      const ajoutee = await service.ajouterSource('user-1', 'journal.fr');

      const creee = mockDepotSources.creer.mock.calls[0][0];
      expect(creee.urlFavicon).toBe('https://journal.fr/icone.png');
      expect(creee.tagsSuggeres).toEqual(['Politique', 'Écologie']);
      expect(mockDepotTags.ajouterTagSource).toHaveBeenCalledWith('us-1', 'tag-politique');
      expect(mockDepotTags.ajouterTagSource).toHaveBeenCalledWith('us-1', 'tag-écologie');
      expect(ajoutee.tags.map(t => t.nom)).toEqual(['Politique', 'Écologie']);
    });

    it('reprend les tags suggérés d\'une source déjà connue, sans nouvelle détection', async () => {
      mockDepotSources.trouverParHashUrl.mockResolvedValue({ id: 'src-existante', url: 'https://journal.fr/feed', nom: 'Journal', tagsSuggeres: ['Sciences'] });
      mockDepotSources.ajouterPourUtilisateur.mockResolvedValue({ id: 'us-2', sourceId: 'src-existante', nom: 'Journal', tags: [] });
      const { ServiceSources } = await import('@/domaine/services/ServiceSources');
      const service = new ServiceSources(mockDepotSources as never, mockDepotParametres as never, mockDetecteurSource, undefined, mockDepotTags);

      const ajoutee = await service.ajouterSource('user-2', 'https://journal.fr/feed');

      expect(mockDetecteurSource).not.toHaveBeenCalled();
      expect(mockDepotTags.ajouterTagSource).toHaveBeenCalledWith('us-2', 'tag-sciences');
      expect(ajoutee.tags.map(t => t.nom)).toEqual(['Sciences']);
    });

    it('enregistre l\'URL du flux découvert à la place de la page saisie', async () => {
      mockDetecteurSource.mockResolvedValue({ url: 'https://journal.fr/articles/feed', type: 'rss', titre: 'Journal', favicon: null });
      mockDepotSources.creer.mockImplementation(async (donnees: Record<string, unknown>) => ({ id: 'src-1', ...donnees }));
      mockDepotSources.ajouterPourUtilisateur.mockResolvedValue({ id: 'us-1', sourceId: 'src-1', nom: 'Journal' });

      const { ServiceSources } = await import('@/domaine/services/ServiceSources');
      const service = new ServiceSources(mockDepotSources as never, mockDepotParametres as never, mockDetecteurSource);
      await service.ajouterSource('user-1', 'https://journal.fr');

      const creee = mockDepotSources.creer.mock.calls[0][0];
      expect(creee.url).toBe('https://journal.fr/articles/feed');
      expect(creee.typeSource).toBe('rss');
      // Le hash est celui du flux, pour dédupliquer avec un utilisateur qui aurait collé le flux directement
      expect(mockDepotSources.trouverParHashUrl).toHaveBeenLastCalledWith(createHash('md5').update(normaliserUrl('https://journal.fr/articles/feed')).digest('hex'));
    });

    it('rattache l\'utilisateur à la source existante quand le flux découvert est déjà connu', async () => {
      mockDetecteurSource.mockResolvedValue({ url: 'https://journal.fr/articles/feed', type: 'rss', titre: 'Journal', favicon: null });
      const existante = { id: 'src-existante', url: 'https://journal.fr/articles/feed', nom: 'Journal' };
      mockDepotSources.trouverParHashUrl.mockResolvedValueOnce(null).mockResolvedValueOnce(existante);
      mockDepotSources.ajouterPourUtilisateur.mockResolvedValue({ id: 'us-1', sourceId: 'src-existante', nom: 'Journal' });

      const { ServiceSources } = await import('@/domaine/services/ServiceSources');
      const service = new ServiceSources(mockDepotSources as never, mockDepotParametres as never, mockDetecteurSource);
      await service.ajouterSource('user-1', 'https://journal.fr');

      expect(mockDepotSources.creer).not.toHaveBeenCalled();
      expect(mockDepotSources.ajouterPourUtilisateur).toHaveBeenCalledWith('user-1', 'src-existante');
    });

    it('complète le protocole https quand il manque', async () => {
      mockDetecteurSource.mockResolvedValue({ type: 'rss', titre: null, favicon: null });
      mockDepotSources.creer.mockImplementation(async (donnees: Record<string, unknown>) => ({ id: 'src-1', ...donnees }));
      mockDepotSources.ajouterPourUtilisateur.mockResolvedValue({ id: 'us-1', sourceId: 'src-1', nom: 'journal.fr' });

      const { ServiceSources } = await import('@/domaine/services/ServiceSources');
      const service = new ServiceSources(mockDepotSources as never, mockDepotParametres as never, mockDetecteurSource);
      await service.ajouterSource('user-1', '  journal.fr/rss  ');

      expect(mockDepotSources.creer.mock.calls[0][0].url).toBe('https://journal.fr/rss');
      // Le détecteur reçoit la saisie brute : c'est lui qui tranche entre https et http
      expect(mockDetecteurSource).toHaveBeenCalledWith('journal.fr/rss');
    });

    it('refuse un site injoignable avec un code dédié', async () => {
      mockDetecteurSource.mockResolvedValue({ url: 'https://hote-inexistant.example', type: 'html', titre: null, favicon: null, joignable: false });
      const { ServiceSources } = await import('@/domaine/services/ServiceSources');
      const service = new ServiceSources(mockDepotSources as never, mockDepotParametres as never, mockDetecteurSource);

      await expect(service.ajouterSource('user-1', 'hote-inexistant.example')).rejects.toMatchObject({ code: 'SITE_INJOIGNABLE' });
      expect(mockDepotSources.creer).not.toHaveBeenCalled();
    });

    it('rejette une saisie sans nom de domaine', async () => {
      const { ServiceSources } = await import('@/domaine/services/ServiceSources');
      const service = new ServiceSources(mockDepotSources as never, mockDepotParametres as never, mockDetecteurSource);

      await expect(service.ajouterSource('user-1', 'not-a-valid-url')).rejects.toMatchObject({ code: 'URL_INVALIDE' });
      expect(mockDetecteurSource).not.toHaveBeenCalled();
    });

    it('invalide le cache des sources et celui du fil à l\'ajout d\'une source', async () => {
      mockDetecteurSource.mockResolvedValue({ type: 'rss', titre: 'Journal', favicon: null });
      mockDepotSources.creer.mockImplementation(async (donnees: Record<string, unknown>) => ({ id: 'src-1', ...donnees }));
      mockDepotSources.ajouterPourUtilisateur.mockResolvedValue({ id: 'us-1', sourceId: 'src-1', nom: 'Journal' });
      const mockCache = { supprimer: vi.fn().mockResolvedValue(true), supprimerPattern: vi.fn().mockResolvedValue(1) };

      const { ServiceSources } = await import('@/domaine/services/ServiceSources');
      const service = new ServiceSources(mockDepotSources as never, mockDepotParametres as never, mockDetecteurSource, mockCache as never);
      await service.ajouterSource('user-1', 'https://journal.fr/feed');

      expect(mockCache.supprimer).toHaveBeenCalledWith(expect.stringContaining('user-1'));
      expect(mockCache.supprimerPattern).toHaveBeenCalledWith('articles:fil:user-1:*');
    });

    it('devrait ajouter une nouvelle source valide', async () => {
      const { ServiceSources } = await import('@/domaine/services/ServiceSources');

      const nouvelleSource = {
        id: 'source-123',
        url: 'https://example.com/feed.rss',
        nom: 'Test Blog',
        typeSource: 'rss' as const,
        statut: 'active' as const,
        urlFavicon: 'https://example.com/favicon.ico',
        dateCreation: new Date(),
        dateDerniereSynchro: null,
        hashUrlNormalise: 'abc123',
        nombreEchecs: 0,
      };

      mockDepotSources.creer.mockResolvedValue(nouvelleSource);
      mockDepotSources.ajouterPourUtilisateur.mockResolvedValue({
        ...nouvelleSource,
        dateAjout: new Date(),
        note: null,
        estEnPause: false,
        tags: [],
      });

      const service = new ServiceSources(
        mockDepotSources as never,
        mockDepotParametres as never,
        mockDetecteurSource,
      );

      const resultat = await service.ajouterSource('user-1', 'https://example.com/feed.rss');

      expect(resultat).toBeDefined();
      expect(resultat.nom).toBe('Test Blog');
      expect(mockDepotSources.creer).toHaveBeenCalled();
      expect(mockDepotSources.ajouterPourUtilisateur).toHaveBeenCalledWith('user-1', 'source-123');
    });

    it('devrait rejeter une URL invalide', async () => {
      const { ServiceSources, ErreurSource } = await import('@/domaine/services/ServiceSources');

      const service = new ServiceSources(
        mockDepotSources as never,
        mockDepotParametres as never,
        mockDetecteurSource,
      );

      await expect(service.ajouterSource('user-1', 'not-a-url')).rejects.toThrow(ErreurSource);
      await expect(service.ajouterSource('user-1', 'not-a-url')).rejects.toThrow('URL invalide');
    });

    it('devrait rejeter si la limite de sources est atteinte', async () => {
      mockDepotSources.compterSourcesUtilisateur.mockResolvedValue(100);

      const { ServiceSources, ErreurSource } = await import('@/domaine/services/ServiceSources');

      const service = new ServiceSources(
        mockDepotSources as never,
        mockDepotParametres as never,
        mockDetecteurSource,
      );

      await expect(
        service.ajouterSource('user-1', 'https://example.com/feed.rss'),
      ).rejects.toThrow(ErreurSource);
      await expect(
        service.ajouterSource('user-1', 'https://example.com/feed.rss'),
      ).rejects.toThrow('Limite');
    });

    it('devrait rejeter si l\'utilisateur suit déjà la source', async () => {
      const sourceExistante = {
        id: 'source-existing',
        url: 'https://example.com/feed.rss',
        nom: 'Blog Existant',
        typeSource: 'rss',
      };

      mockDepotSources.trouverParHashUrl.mockResolvedValue(sourceExistante);
      mockDepotSources.utilisateurSuitSource.mockResolvedValue(true);

      const { ServiceSources, ErreurSource } = await import('@/domaine/services/ServiceSources');

      const service = new ServiceSources(
        mockDepotSources as never,
        mockDepotParametres as never,
        mockDetecteurSource,
      );

      await expect(
        service.ajouterSource('user-1', 'https://example.com/feed.rss'),
      ).rejects.toThrow(ErreurSource);
      await expect(
        service.ajouterSource('user-1', 'https://example.com/feed.rss'),
      ).rejects.toThrow('déjà');
    });

    it('devrait réutiliser une source existante si un autre utilisateur la suit', async () => {
      const sourceExistante = {
        id: 'source-existing',
        url: 'https://example.com/feed.rss',
        nom: 'Blog Existant',
        typeSource: 'rss' as const,
        statut: 'active' as const,
        urlFavicon: null,
        dateCreation: new Date(),
        dateDerniereSynchro: null,
        hashUrlNormalise: 'abc123',
        nombreEchecs: 0,
      };

      mockDepotSources.trouverParHashUrl.mockResolvedValue(sourceExistante);
      mockDepotSources.utilisateurSuitSource.mockResolvedValue(false);
      mockDepotSources.ajouterPourUtilisateur.mockResolvedValue({
        ...sourceExistante,
        dateAjout: new Date(),
        note: null,
        estEnPause: false,
        tags: [],
      });

      const { ServiceSources } = await import('@/domaine/services/ServiceSources');

      const service = new ServiceSources(
        mockDepotSources as never,
        mockDepotParametres as never,
        mockDetecteurSource,
      );

      const resultat = await service.ajouterSource('user-2', 'https://example.com/feed.rss');

      expect(resultat).toBeDefined();
      expect(mockDepotSources.creer).not.toHaveBeenCalled(); // Pas de création
      expect(mockDepotSources.ajouterPourUtilisateur).toHaveBeenCalledWith('user-2', 'source-existing');
    });

    it('devrait utiliser le nom personnalisé si fourni', async () => {
      const nouvelleSource = {
        id: 'source-123',
        url: 'https://example.com/feed.rss',
        nom: 'Mon Blog Préféré',
        typeSource: 'rss' as const,
        statut: 'active' as const,
        urlFavicon: null,
        dateCreation: new Date(),
        dateDerniereSynchro: null,
        hashUrlNormalise: 'abc123',
        nombreEchecs: 0,
      };

      mockDepotSources.creer.mockResolvedValue(nouvelleSource);
      mockDepotSources.ajouterPourUtilisateur.mockResolvedValue({
        ...nouvelleSource,
        dateAjout: new Date(),
        note: null,
        estEnPause: false,
        tags: [],
      });

      const { ServiceSources } = await import('@/domaine/services/ServiceSources');

      const service = new ServiceSources(
        mockDepotSources as never,
        mockDepotParametres as never,
        mockDetecteurSource,
      );

      await service.ajouterSource('user-1', 'https://example.com/feed.rss', 'Mon Blog Préféré');

      expect(mockDepotSources.creer).toHaveBeenCalledWith(
        expect.objectContaining({ nom: 'Mon Blog Préféré' }),
      );
    });
  });

  describe('retirerSource', () => {
    it('devrait retirer une source suivie', async () => {
      mockDepotSources.utilisateurSuitSource.mockResolvedValue(true);
      mockDepotSources.retirerPourUtilisateur.mockResolvedValue(true);

      const { ServiceSources } = await import('@/domaine/services/ServiceSources');

      const service = new ServiceSources(
        mockDepotSources as never,
        mockDepotParametres as never,
      );

      const resultat = await service.retirerSource('user-1', 'source-123');

      expect(resultat).toBe(true);
      expect(mockDepotSources.retirerPourUtilisateur).toHaveBeenCalledWith('user-1', 'source-123');
    });

    it('devrait rejeter si la source n\'est pas suivie', async () => {
      mockDepotSources.utilisateurSuitSource.mockResolvedValue(false);

      const { ServiceSources, ErreurSource } = await import('@/domaine/services/ServiceSources');

      const service = new ServiceSources(
        mockDepotSources as never,
        mockDepotParametres as never,
      );

      await expect(service.retirerSource('user-1', 'source-unknown')).rejects.toThrow(ErreurSource);
      await expect(service.retirerSource('user-1', 'source-unknown')).rejects.toThrow('introuvable');
    });
  });

  describe('listerSources', () => {
    it('devrait lister les sources d\'un utilisateur', async () => {
      const sourcesList = {
        items: [
          { id: 'source-1', nom: 'Blog 1', tags: [] },
          { id: 'source-2', nom: 'Blog 2', tags: [] },
        ],
        total: 2,
        page: 1,
        limite: 20,
        pages: 1,
      };

      mockDepotSources.listerPourUtilisateur.mockResolvedValue(sourcesList);

      const { ServiceSources } = await import('@/domaine/services/ServiceSources');

      const service = new ServiceSources(
        mockDepotSources as never,
        mockDepotParametres as never,
      );

      const resultat = await service.listerSources('user-1');

      expect(resultat.items).toHaveLength(2);
      expect(resultat.total).toBe(2);
    });

    it('devrait filtrer par statut', async () => {
      mockDepotSources.listerPourUtilisateur.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limite: 20,
        pages: 0,
      });

      const { ServiceSources } = await import('@/domaine/services/ServiceSources');

      const service = new ServiceSources(
        mockDepotSources as never,
        mockDepotParametres as never,
      );

      await service.listerSources('user-1', { statut: 'active' });

      expect(mockDepotSources.listerPourUtilisateur).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ statut: 'active' }),
      );
    });
  });

  describe('basculerPause', () => {
    it('devrait mettre une source en pause', async () => {
      mockDepotSources.utilisateurSuitSource.mockResolvedValue(true);
      mockDepotSources.basculerPause.mockResolvedValue(true);

      const { ServiceSources } = await import('@/domaine/services/ServiceSources');

      const service = new ServiceSources(
        mockDepotSources as never,
        mockDepotParametres as never,
      );

      const resultat = await service.basculerPause('user-1', 'source-123', true);

      expect(resultat).toBe(true);
      expect(mockDepotSources.basculerPause).toHaveBeenCalledWith('user-1', 'source-123', true);
    });

    it('devrait reprendre une source en pause', async () => {
      mockDepotSources.utilisateurSuitSource.mockResolvedValue(true);
      mockDepotSources.basculerPause.mockResolvedValue(true);

      const { ServiceSources } = await import('@/domaine/services/ServiceSources');

      const service = new ServiceSources(
        mockDepotSources as never,
        mockDepotParametres as never,
      );

      const resultat = await service.basculerPause('user-1', 'source-123', false);

      expect(resultat).toBe(true);
      expect(mockDepotSources.basculerPause).toHaveBeenCalledWith('user-1', 'source-123', false);
    });
  });

  describe('noterSource', () => {
    it('devrait noter une source de 1 à 5', async () => {
      mockDepotSources.utilisateurSuitSource.mockResolvedValue(true);
      mockDepotSources.noterSource.mockResolvedValue(true);

      const { ServiceSources } = await import('@/domaine/services/ServiceSources');

      const service = new ServiceSources(
        mockDepotSources as never,
        mockDepotParametres as never,
      );

      const resultat = await service.noterSource('user-1', 'source-123', 5);

      expect(resultat).toBe(true);
      expect(mockDepotSources.noterSource).toHaveBeenCalledWith('user-1', 'source-123', 5);
    });

    it('devrait permettre de retirer une note (null)', async () => {
      mockDepotSources.utilisateurSuitSource.mockResolvedValue(true);
      mockDepotSources.noterSource.mockResolvedValue(true);

      const { ServiceSources } = await import('@/domaine/services/ServiceSources');

      const service = new ServiceSources(
        mockDepotSources as never,
        mockDepotParametres as never,
      );

      const resultat = await service.noterSource('user-1', 'source-123', null);

      expect(resultat).toBe(true);
      expect(mockDepotSources.noterSource).toHaveBeenCalledWith('user-1', 'source-123', null);
    });
  });

  describe('utilitaires', () => {
    it('genererHashUrl devrait produire un hash cohérent', async () => {
      const { ServiceSources } = await import('@/domaine/services/ServiceSources');

      const service = new ServiceSources(
        mockDepotSources as never,
        mockDepotParametres as never,
      );

      // Accès à la méthode privée via any
      const hash1 = (service as unknown as { genererHashUrl: (url: string) => string }).genererHashUrl(
        'https://example.com/feed',
      );
      const hash2 = (service as unknown as { genererHashUrl: (url: string) => string }).genererHashUrl(
        'https://example.com/feed',
      );
      const hash3 = (service as unknown as { genererHashUrl: (url: string) => string }).genererHashUrl(
        'https://other.com/feed',
      );

      expect(hash1).toBe(hash2); // Même URL = même hash
      expect(hash1).not.toBe(hash3); // URL différente = hash différent
      expect(hash1.length).toBe(32); // Hash tronqué à 32 caractères
    });
  });
});
