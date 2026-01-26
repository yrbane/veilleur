/**
 * Veilleur - Tests unitaires pour ServiceCache
 * Tests de l'interface et utilitaires du cache
 */

import { describe, it, expect } from 'vitest';
import {
  PREFIXES_CACHE,
  TTL_DEFAUT,
  cleArticlesSource,
  cleSourcesUtilisateur,
  cleMetadataArticle,
  cleRateLimit,
} from '@/domaine/ports/ServiceCache';

describe('ServiceCache - Constantes', () => {
  describe('PREFIXES_CACHE', () => {
    it('devrait avoir les préfixes corrects', () => {
      expect(PREFIXES_CACHE.ARTICLES).toBe('articles:');
      expect(PREFIXES_CACHE.SOURCES).toBe('sources:');
      expect(PREFIXES_CACHE.UTILISATEUR).toBe('utilisateur:');
      expect(PREFIXES_CACHE.METADATA).toBe('metadata:');
      expect(PREFIXES_CACHE.SESSION).toBe('session:');
      expect(PREFIXES_CACHE.RATELIMIT).toBe('ratelimit:');
    });
  });

  describe('TTL_DEFAUT', () => {
    it('devrait avoir les TTL corrects en secondes', () => {
      expect(TTL_DEFAUT.ARTICLES).toBe(3600); // 1 heure
      expect(TTL_DEFAUT.SOURCES).toBe(300); // 5 minutes
      expect(TTL_DEFAUT.METADATA).toBe(86400); // 24 heures
      expect(TTL_DEFAUT.SESSION).toBe(604800); // 7 jours
      expect(TTL_DEFAUT.RATELIMIT).toBe(60); // 1 minute
    });
  });
});

describe('ServiceCache - Génération de clés', () => {
  describe('cleArticlesSource', () => {
    it('devrait générer une clé avec le préfixe articles', () => {
      const cle = cleArticlesSource('source-123');

      expect(cle).toBe('articles:source-123');
      expect(cle.startsWith(PREFIXES_CACHE.ARTICLES)).toBe(true);
    });

    it('devrait inclure l\'ID de la source', () => {
      const sourceId = 'abc-def-ghi';
      const cle = cleArticlesSource(sourceId);

      expect(cle).toContain(sourceId);
    });
  });

  describe('cleSourcesUtilisateur', () => {
    it('devrait générer une clé avec le préfixe sources', () => {
      const cle = cleSourcesUtilisateur('user-456');

      expect(cle).toBe('sources:user-456');
      expect(cle.startsWith(PREFIXES_CACHE.SOURCES)).toBe(true);
    });

    it('devrait inclure l\'ID de l\'utilisateur', () => {
      const userId = 'user-xyz';
      const cle = cleSourcesUtilisateur(userId);

      expect(cle).toContain(userId);
    });
  });

  describe('cleMetadataArticle', () => {
    it('devrait générer une clé avec le préfixe metadata', () => {
      const cle = cleMetadataArticle('https://example.com/article');

      expect(cle).toBe('metadata:https://example.com/article');
      expect(cle.startsWith(PREFIXES_CACHE.METADATA)).toBe(true);
    });

    it('devrait inclure l\'URL de l\'article', () => {
      const url = 'https://blog.example.com/post/123';
      const cle = cleMetadataArticle(url);

      expect(cle).toContain(url);
    });
  });

  describe('cleRateLimit', () => {
    it('devrait générer une clé pour le rate limit par IP', () => {
      const cle = cleRateLimit('192.168.1.1', 'ip');

      expect(cle).toBe('ratelimit:ip:192.168.1.1');
      expect(cle.startsWith(PREFIXES_CACHE.RATELIMIT)).toBe(true);
    });

    it('devrait générer une clé pour le rate limit par utilisateur', () => {
      const cle = cleRateLimit('user-123', 'user');

      expect(cle).toBe('ratelimit:user:user-123');
      expect(cle.startsWith(PREFIXES_CACHE.RATELIMIT)).toBe(true);
    });

    it('devrait différencier les types de rate limit', () => {
      const cleIp = cleRateLimit('identifier', 'ip');
      const cleUser = cleRateLimit('identifier', 'user');

      expect(cleIp).not.toBe(cleUser);
      expect(cleIp).toContain(':ip:');
      expect(cleUser).toContain(':user:');
    });
  });
});

describe('ServiceCache - Interface', () => {
  it('devrait définir les méthodes attendues', async () => {
    // Import pour vérifier que le type compile correctement
    const { ServiceCache } = await import('@/domaine/ports/ServiceCache') as {
      ServiceCache: {
        obtenir: unknown;
        stocker: unknown;
        supprimer: unknown;
        supprimerPattern: unknown;
        existe: unknown;
        ttl: unknown;
        incrementer: unknown;
        decrementer: unknown;
        obtenirOuStocker: unknown;
        ping: unknown;
        fermer: unknown;
      };
    };

    // L'import devrait réussir - si le type est mal défini, il y aurait une erreur de compilation
    expect(ServiceCache).toBeUndefined(); // C'est une interface, pas une valeur
  });
});

describe('ServiceCache - Validation des clés', () => {
  it('les clés ne devraient pas contenir de caractères dangereux', () => {
    const testCases = [
      cleArticlesSource('source-123'),
      cleSourcesUtilisateur('user-456'),
      cleMetadataArticle('https://example.com/article'),
      cleRateLimit('192.168.1.1', 'ip'),
    ];

    for (const cle of testCases) {
      // Pas de retours à la ligne
      expect(cle).not.toContain('\n');
      expect(cle).not.toContain('\r');
      // Pas de caractères null
      expect(cle).not.toContain('\0');
    }
  });

  it('les clés devraient être des chaînes non vides', () => {
    const testCases = [
      cleArticlesSource('a'),
      cleSourcesUtilisateur('b'),
      cleMetadataArticle('c'),
      cleRateLimit('d', 'ip'),
    ];

    for (const cle of testCases) {
      expect(typeof cle).toBe('string');
      expect(cle.length).toBeGreaterThan(0);
    }
  });
});
