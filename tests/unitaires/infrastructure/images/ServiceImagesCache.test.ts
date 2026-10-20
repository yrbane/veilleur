/**
 * Veilleur - Tests unitaires pour ServiceImagesCache
 * Tests du service principal de cache d'images
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DepotImagesCache } from '@/infrastructure/images/ServiceImagesCache';

// Mock du cache Redis
const mockObtenir = vi.fn();
const mockStocker = vi.fn();
const mockSupprimer = vi.fn();

vi.mock('@/infrastructure/cache/ServiceCacheRedis', () => ({
  obtenirServiceCache: () => ({
    obtenir: mockObtenir,
    stocker: mockStocker,
    supprimer: mockSupprimer,
  }),
}));

vi.mock('@/infrastructure/cache/clesRedis', () => ({
  cles: {
    image: {
      parHash: (hash: string) => `v:c:img:${hash}`,
      statut: (hash: string) => `v:c:img:statut:${hash}`,
    },
  },
  TTL: {
    CACHE_LONG: 3600,
  },
}));

// Mock du gestionnaire de stockage
const mockExiste = vi.fn();
const mockLire = vi.fn();
const mockSupprimerTousLesFichiers = vi.fn();
const mockCalculerEspaceUtilise = vi.fn();

vi.mock('@/infrastructure/images/GestionnaireStockage', () => ({
  obtenirGestionnaireStockage: () => ({
    existe: mockExiste,
    lire: mockLire,
    supprimerTousLesFichiers: mockSupprimerTousLesFichiers,
    calculerEspaceUtilise: mockCalculerEspaceUtilise,
  }),
  GestionnaireStockage: vi.fn(),
}));

// Mock du téléchargeur
const mockTelecharger = vi.fn();
const mockSupprimerTemporaire = vi.fn();

vi.mock('@/infrastructure/images/TelechargeursImages', () => ({
  obtenirTelechargeursImages: () => ({
    telecharger: mockTelecharger,
    supprimerTemporaire: mockSupprimerTemporaire,
  }),
  TelechargeursImages: vi.fn(),
}));

// Mock du traitement
const mockTraiter = vi.fn();

vi.mock('@/infrastructure/images/TraitementImages', () => ({
  obtenirTraitementImages: () => ({
    traiter: mockTraiter,
  }),
  TraitementImages: vi.fn(),
}));

// Mock du logger
vi.mock('@/infrastructure/logging/logger', () => ({
  loggerJobs: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ServiceImagesCache', () => {
  // Mock du dépôt
  const mockDepot = {
    trouverParHash: vi.fn(),
    creer: vi.fn(),
    mettreAJour: vi.fn(),
    incrementerUtilisation: vi.fn(),
    listerParStatut: vi.fn(),
    listerNonAccedeesDepuis: vi.fn(),
    supprimer: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockObtenir.mockResolvedValue(null);
    mockStocker.mockResolvedValue(undefined);
    mockSupprimer.mockResolvedValue(true);
    mockExiste.mockReturnValue(true);
    mockSupprimerTemporaire.mockResolvedValue(undefined);
    mockDepot.incrementerUtilisation.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('hashUrl', () => {
    it('devrait générer un hash MD5 cohérent', async () => {
      const { ServiceImagesCache } = await import('@/infrastructure/images/ServiceImagesCache');

      const hash1 = ServiceImagesCache.hashUrl('https://example.com/image.jpg');
      const hash2 = ServiceImagesCache.hashUrl('https://example.com/image.jpg');
      const hash3 = ServiceImagesCache.hashUrl('https://example.com/other.jpg');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toHaveLength(32); // MD5 = 32 caractères hex
    });

    it('devrait normaliser les URLs (minuscules, trim)', async () => {
      const { ServiceImagesCache } = await import('@/infrastructure/images/ServiceImagesCache');

      const hash1 = ServiceImagesCache.hashUrl('https://EXAMPLE.com/image.jpg');
      const hash2 = ServiceImagesCache.hashUrl('https://example.com/image.jpg');
      const hash3 = ServiceImagesCache.hashUrl('  https://example.com/image.jpg  ');

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });
  });

  describe('demanderCache', () => {
    it('devrait créer une nouvelle entrée si l\'image n\'existe pas', async () => {
      mockDepot.trouverParHash.mockResolvedValue(null);
      mockDepot.creer.mockResolvedValue({
        id: 'test-id',
        hashUrl: 'abc123',
        urlOriginale: 'https://example.com/img.jpg',
        statut: 'en_attente',
      });

      const { ServiceImagesCache } = await import('@/infrastructure/images/ServiceImagesCache');
      const service = new ServiceImagesCache(mockDepot as unknown as DepotImagesCache);

      const hash = await service.demanderCache('https://example.com/img.jpg');

      expect(hash).toHaveLength(32);
      expect(mockDepot.creer).toHaveBeenCalled();
    });

    it('devrait retourner le hash existant si image déjà en cache', async () => {
      const imageCachee = {
        id: 'test-id',
        hashUrl: 'abc123',
        urlOriginale: 'https://example.com/img.jpg',
        statut: 'termine',
      };
      mockObtenir.mockResolvedValue(imageCachee);

      const { ServiceImagesCache } = await import('@/infrastructure/images/ServiceImagesCache');
      const service = new ServiceImagesCache(mockDepot as unknown as DepotImagesCache);

      await service.demanderCache('https://example.com/img.jpg');

      expect(mockDepot.incrementerUtilisation).toHaveBeenCalled();
    });
  });

  describe('traiterImage', () => {
    it('devrait télécharger et traiter une image avec succès', async () => {
      mockTelecharger.mockResolvedValue({
        succes: true,
        cheminTemporaire: '/tmp/img.jpg',
        typeMime: 'image/jpeg',
        tailleFichier: 12345,
      });
      mockTraiter.mockResolvedValue({
        succes: true,
        cheminLocal: 'originales/abc.webp',
        cheminMiniatureSm: 'miniatures/abc-sm.webp',
        cheminMiniatureMd: 'miniatures/abc-md.webp',
        largeur: 800,
        hauteur: 600,
      });
      mockDepot.mettreAJour.mockResolvedValue({
        id: 'test-id',
        hashUrl: 'abc123',
        statut: 'termine',
      });

      const { ServiceImagesCache } = await import('@/infrastructure/images/ServiceImagesCache');
      const service = new ServiceImagesCache(mockDepot as unknown as DepotImagesCache);

      const resultat = await service.traiterImage('abc123', 'https://example.com/img.jpg');

      expect(resultat).toBe(true);
      expect(mockTelecharger).toHaveBeenCalledWith('https://example.com/img.jpg');
      expect(mockTraiter).toHaveBeenCalled();
      expect(mockDepot.mettreAJour).toHaveBeenCalledWith('abc123', expect.objectContaining({
        statut: 'termine',
      }));
      expect(mockSupprimerTemporaire).toHaveBeenCalled();
    });

    it('devrait marquer comme échec si le téléchargement échoue', async () => {
      mockTelecharger.mockResolvedValue({
        succes: false,
        erreur: 'Timeout',
      });
      mockDepot.mettreAJour.mockResolvedValue(null);

      const { ServiceImagesCache } = await import('@/infrastructure/images/ServiceImagesCache');
      const service = new ServiceImagesCache(mockDepot as unknown as DepotImagesCache);

      const resultat = await service.traiterImage('abc123', 'https://example.com/img.jpg');

      expect(resultat).toBe(false);
      expect(mockDepot.mettreAJour).toHaveBeenCalledWith('abc123', expect.objectContaining({
        statut: 'echec',
      }));
    });
  });

  describe('obtenirDonnees', () => {
    it('devrait retourner les données de l\'image', async () => {
      const imageCachee = {
        id: 'test-id',
        hashUrl: 'abc123',
        cheminMiniatureSm: 'miniatures/abc-sm.webp',
        statut: 'termine',
      };
      mockObtenir.mockResolvedValue(imageCachee);
      mockLire.mockResolvedValue(Buffer.from('image-data'));

      const { ServiceImagesCache } = await import('@/infrastructure/images/ServiceImagesCache');
      const service = new ServiceImagesCache(mockDepot as unknown as DepotImagesCache);

      const resultat = await service.obtenirDonnees('abc123', 'sm', 'webp');

      expect(resultat).not.toBeNull();
      expect(resultat?.typeMime).toBe('image/webp');
      expect(resultat?.donnees).toBeInstanceOf(Buffer);
    });

    it('devrait retourner null si l\'image n\'existe pas', async () => {
      mockObtenir.mockResolvedValue(null);
      mockDepot.trouverParHash.mockResolvedValue(null);

      const { ServiceImagesCache } = await import('@/infrastructure/images/ServiceImagesCache');
      const service = new ServiceImagesCache(mockDepot as unknown as DepotImagesCache);

      const resultat = await service.obtenirDonnees('nonexistent', 'sm', 'webp');

      expect(resultat).toBeNull();
    });
  });

  describe('transformerUrlPourCache', () => {
    it('devrait transformer une URL en URL cachée', async () => {
      const { ServiceImagesCache } = await import('@/infrastructure/images/ServiceImagesCache');
      const service = new ServiceImagesCache(mockDepot as unknown as DepotImagesCache);

      const url = service.transformerUrlPourCache('https://example.com/image.jpg', 'sm');

      expect(url).toMatch(/^\/api\/v1\/images\/[a-f0-9]{32}\/sm$/);
    });

    it('devrait retourner null si l\'URL est null', async () => {
      const { ServiceImagesCache } = await import('@/infrastructure/images/ServiceImagesCache');
      const service = new ServiceImagesCache(mockDepot as unknown as DepotImagesCache);

      const url = service.transformerUrlPourCache(null, 'sm');

      expect(url).toBeNull();
    });
  });

  describe('nettoyerImagesAnciennes', () => {
    it('devrait supprimer les images non accédées', async () => {
      const imagesAnciennes = [
        { hashUrl: 'hash1', id: '1' },
        { hashUrl: 'hash2', id: '2' },
      ];
      mockDepot.listerNonAccedeesDepuis.mockResolvedValue(imagesAnciennes);
      mockSupprimerTousLesFichiers.mockResolvedValue(3);
      mockDepot.supprimer.mockResolvedValue(true);

      const { ServiceImagesCache } = await import('@/infrastructure/images/ServiceImagesCache');
      const service = new ServiceImagesCache(mockDepot as unknown as DepotImagesCache);

      const supprimees = await service.nettoyerImagesAnciennes(90);

      expect(supprimees).toBe(2);
      expect(mockSupprimerTousLesFichiers).toHaveBeenCalledTimes(2);
      expect(mockDepot.supprimer).toHaveBeenCalledTimes(2);
    });
  });
});
