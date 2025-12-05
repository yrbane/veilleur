/**
 * Tests unitaires - Entité Source
 */

import { describe, it, expect } from 'vitest';
import {
  schemaSource,
  schemaAjoutSource,
  normaliserUrl,
  hashUrl,
  doitEtreEnErreur,
  SEUIL_ECHECS_SOURCE,
} from '../../../src/domaine/entites/Source';

describe('Source', () => {
  describe('schemaSource', () => {
    it('devrait valider une source complète', () => {
      const source = {
        id: 'source-123',
        url: 'https://example.com/feed.xml',
        nom: 'Mon flux RSS',
        typeSource: 'rss' as const,
        statut: 'active' as const,
        urlFavicon: 'https://example.com/favicon.ico',
        dateCreation: new Date(),
        dateDerniereSynchro: new Date(),
        hashUrlNormalise: 'a'.repeat(32),
        nombreEchecs: 0,
      };

      const result = schemaSource.safeParse(source);
      expect(result.success).toBe(true);
    });

    it('devrait rejeter une URL invalide', () => {
      const source = {
        id: 'source-123',
        url: 'pas-une-url',
        nom: 'Test',
        typeSource: 'rss' as const,
        statut: 'active' as const,
        urlFavicon: null,
        dateCreation: new Date(),
        dateDerniereSynchro: null,
        hashUrlNormalise: null,
        nombreEchecs: 0,
      };

      const result = schemaSource.safeParse(source);
      expect(result.success).toBe(false);
    });

    it('devrait accepter les types de source valides', () => {
      const types = ['rss', 'atom', 'html'] as const;

      for (const typeSource of types) {
        const source = {
          id: 'source-123',
          url: 'https://example.com/feed.xml',
          nom: 'Test',
          typeSource,
          statut: 'active' as const,
          urlFavicon: null,
          dateCreation: new Date(),
          dateDerniereSynchro: null,
          hashUrlNormalise: null,
          nombreEchecs: 0,
        };

        const result = schemaSource.safeParse(source);
        expect(result.success).toBe(true);
      }
    });

    it('devrait rejeter un type de source invalide', () => {
      const source = {
        id: 'source-123',
        url: 'https://example.com/feed.xml',
        nom: 'Test',
        typeSource: 'invalide',
        statut: 'active',
        urlFavicon: null,
        dateCreation: new Date(),
        dateDerniereSynchro: null,
        hashUrlNormalise: null,
        nombreEchecs: 0,
      };

      const result = schemaSource.safeParse(source);
      expect(result.success).toBe(false);
    });
  });

  describe('schemaAjoutSource', () => {
    it('devrait valider une URL seule', () => {
      const result = schemaAjoutSource.safeParse({
        url: 'https://example.com/feed.xml',
      });
      expect(result.success).toBe(true);
    });

    it('devrait valider une URL avec nom', () => {
      const result = schemaAjoutSource.safeParse({
        url: 'https://example.com/feed.xml',
        nom: 'Mon flux',
      });
      expect(result.success).toBe(true);
    });

    it('devrait rejeter une URL invalide', () => {
      const result = schemaAjoutSource.safeParse({
        url: 'pas-une-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('normaliserUrl', () => {
    it('devrait retirer le protocole', () => {
      const url1 = normaliserUrl('https://example.com/feed');
      const url2 = normaliserUrl('http://example.com/feed');
      expect(url1).toBe(url2);
    });

    it('devrait retirer www', () => {
      const url1 = normaliserUrl('https://www.example.com/feed');
      const url2 = normaliserUrl('https://example.com/feed');
      expect(url1).toBe(url2);
    });

    it('devrait retirer le slash final', () => {
      const url1 = normaliserUrl('https://example.com/feed/');
      const url2 = normaliserUrl('https://example.com/feed');
      expect(url1).toBe(url2);
    });

    it('devrait convertir en minuscules', () => {
      const url1 = normaliserUrl('https://EXAMPLE.COM/FEED');
      const url2 = normaliserUrl('https://example.com/feed');
      expect(url1).toBe(url2);
    });

    it('devrait gérer les URLs invalides', () => {
      const result = normaliserUrl('pas-une-url');
      expect(result).toBe('pas-une-url');
    });
  });

  describe('hashUrl', () => {
    it('devrait générer un hash de 32 caractères', async () => {
      const hash = await hashUrl('https://example.com/feed.xml');
      expect(hash).toHaveLength(32);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });

    it('devrait générer le même hash pour URLs équivalentes', async () => {
      const hash1 = await hashUrl('https://example.com/feed.xml');
      const hash2 = await hashUrl('https://www.example.com/feed.xml/');
      expect(hash1).toBe(hash2);
    });

    it('devrait générer des hashs différents pour URLs différentes', async () => {
      const hash1 = await hashUrl('https://example.com/feed1.xml');
      const hash2 = await hashUrl('https://example.com/feed2.xml');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('doitEtreEnErreur', () => {
    it('devrait retourner false pour moins de 3 échecs', () => {
      const source = {
        id: 'source-123',
        url: 'https://example.com/feed.xml',
        nom: 'Test',
        typeSource: 'rss' as const,
        statut: 'active' as const,
        urlFavicon: null,
        dateCreation: new Date(),
        dateDerniereSynchro: null,
        hashUrlNormalise: null,
        nombreEchecs: 2,
      };

      expect(doitEtreEnErreur(source)).toBe(false);
    });

    it('devrait retourner true pour 3 échecs ou plus', () => {
      const source = {
        id: 'source-123',
        url: 'https://example.com/feed.xml',
        nom: 'Test',
        typeSource: 'rss' as const,
        statut: 'active' as const,
        urlFavicon: null,
        dateCreation: new Date(),
        dateDerniereSynchro: null,
        hashUrlNormalise: null,
        nombreEchecs: SEUIL_ECHECS_SOURCE,
      };

      expect(doitEtreEnErreur(source)).toBe(true);
    });
  });
});
