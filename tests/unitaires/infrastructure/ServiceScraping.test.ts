/**
 * Veilleur - Tests unitaires pour ServiceScraping
 * Tests de l'extraction RSS, HTML et métadonnées
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock validation URL AVANT tout import
const mockValiderUrlScraping = vi.fn();
vi.mock('@/infrastructure/scraping/validationUrl', () => ({
  validerUrlScraping: mockValiderUrlScraping,
}));

// Mock de la config
vi.mock('@/config/environnement', () => ({
  env: {
    SCRAPING_TIMEOUT_MS: 5000,
    SCRAPING_USER_AGENT: 'VeilleurBot/1.0',
  },
}));

// Mock du logger
vi.mock('@/infrastructure/logging/logger', () => ({
  loggerScraping: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ServiceScraping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValiderUrlScraping.mockReturnValue({
      valide: true,
      urlNormalisee: 'https://example.com/test',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('extraireArticles - validation SSRF', () => {
    it('devrait bloquer les URLs localhost', async () => {
      mockValiderUrlScraping.mockReturnValue({
        valide: false,
        erreur: 'URL localhost bloquée',
      });

      const { ServiceScraping } = await import('@/infrastructure/scraping/ServiceScraping');
      const service = new ServiceScraping();

      await expect(
        service.extraireArticles('http://localhost:3000/admin'),
      ).rejects.toThrow('URL invalide: URL localhost bloquée');
    });

    it('devrait bloquer les URLs 127.0.0.1', async () => {
      mockValiderUrlScraping.mockReturnValue({
        valide: false,
        erreur: 'URL IP locale bloquée',
      });

      const { ServiceScraping } = await import('@/infrastructure/scraping/ServiceScraping');
      const service = new ServiceScraping();

      await expect(
        service.extraireArticles('http://127.0.0.1/secret'),
      ).rejects.toThrow('URL invalide');
    });

    it('devrait bloquer les URLs internes 192.168.x.x', async () => {
      mockValiderUrlScraping.mockReturnValue({
        valide: false,
        erreur: 'URL réseau privé bloquée',
      });

      const { ServiceScraping } = await import('@/infrastructure/scraping/ServiceScraping');
      const service = new ServiceScraping();

      await expect(
        service.extraireArticles('http://192.168.1.1/admin'),
      ).rejects.toThrow('URL invalide');
    });

    it('devrait bloquer les URLs 10.x.x.x', async () => {
      mockValiderUrlScraping.mockReturnValue({
        valide: false,
        erreur: 'URL réseau privé bloquée',
      });

      const { ServiceScraping } = await import('@/infrastructure/scraping/ServiceScraping');
      const service = new ServiceScraping();

      await expect(
        service.extraireArticles('http://10.0.0.1/internal'),
      ).rejects.toThrow('URL invalide');
    });
  });

  describe('detecterType - validation', () => {
    it('devrait lever une erreur si URL invalide', async () => {
      mockValiderUrlScraping.mockReturnValue({
        valide: false,
        erreur: 'URL malformée',
      });

      const { ServiceScraping } = await import('@/infrastructure/scraping/ServiceScraping');
      const service = new ServiceScraping();

      await expect(
        service.detecterType('not-a-url'),
      ).rejects.toThrow('URL invalide: URL malformée');
    });
  });

  describe('obtenirServiceScraping', () => {
    it('devrait retourner un singleton', async () => {
      const { obtenirServiceScraping } = await import('@/infrastructure/scraping/ServiceScraping');

      const service1 = obtenirServiceScraping();
      const service2 = obtenirServiceScraping();

      expect(service1).toBe(service2);
    });
  });

  describe('options', () => {
    it('devrait accepter des options personnalisées', async () => {
      const { ServiceScraping } = await import('@/infrastructure/scraping/ServiceScraping');

      const service = new ServiceScraping({
        timeout: 10000,
        maxArticles: 100,
        userAgent: 'CustomBot/2.0',
      });

      expect(service).toBeDefined();
    });

    it('devrait utiliser les valeurs par défaut si pas d\'options', async () => {
      const { ServiceScraping } = await import('@/infrastructure/scraping/ServiceScraping');

      const service = new ServiceScraping();

      expect(service).toBeDefined();
    });
  });

  describe('enrichirArticle - validation', () => {
    it('devrait retourner des métadonnées vides si URL invalide', async () => {
      mockValiderUrlScraping.mockReturnValue({
        valide: false,
        erreur: 'URL bloquée',
      });

      const { ServiceScraping } = await import('@/infrastructure/scraping/ServiceScraping');
      const service = new ServiceScraping();

      const meta = await service.enrichirArticle('http://localhost/article');

      expect(meta.openGraph).toEqual({});
      expect(meta.twitter).toEqual({});
    });
  });
});

describe('validationUrl', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('devrait être importable', async () => {
    // Enlever le mock pour tester le vrai module
    vi.doUnmock('@/infrastructure/scraping/validationUrl');

    const { validerUrlScraping } = await import('@/infrastructure/scraping/validationUrl');

    expect(typeof validerUrlScraping).toBe('function');
  });
});
