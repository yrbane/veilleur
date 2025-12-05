/**
 * Tests unitaires - Entité Article
 */

import { describe, it, expect } from 'vitest';
import {
  schemaArticle,
  tronquerResume,
  hashContenu,
  selectionnerImage,
  selectionnerResume,
  MAX_LONGUEUR_RESUME,
} from '../../../src/domaine/entites/Article';

describe('Article', () => {
  describe('schemaArticle', () => {
    it('devrait valider un article complet', () => {
      const article = {
        id: 'article-123',
        sourceId: 'source-456',
        titre: 'Mon article de test',
        lien: 'https://example.com/article/1',
        datePublication: new Date(),
        resume: 'Ceci est un résumé.',
        urlImage: 'https://example.com/image.jpg',
        auteur: 'Jean Dupont',
        metaOpenGraph: { titre: 'OG Title' },
        metaTwitter: { card: 'summary' },
        hashContenu: 'a'.repeat(32),
        dateExtraction: new Date(),
      };

      const result = schemaArticle.safeParse(article);
      expect(result.success).toBe(true);
    });

    it('devrait valider un article minimal', () => {
      const article = {
        id: 'article-123',
        sourceId: 'source-456',
        titre: 'Mon article',
        lien: 'https://example.com/article/1',
        datePublication: new Date(),
        resume: null,
        urlImage: null,
        auteur: null,
        metaOpenGraph: {},
        metaTwitter: {},
        hashContenu: null,
        dateExtraction: new Date(),
      };

      const result = schemaArticle.safeParse(article);
      expect(result.success).toBe(true);
    });

    it('devrait rejeter un titre trop long', () => {
      const article = {
        id: 'article-123',
        sourceId: 'source-456',
        titre: 'A'.repeat(600),
        lien: 'https://example.com/article/1',
        datePublication: new Date(),
        resume: null,
        urlImage: null,
        auteur: null,
        metaOpenGraph: {},
        metaTwitter: {},
        hashContenu: null,
        dateExtraction: new Date(),
      };

      const result = schemaArticle.safeParse(article);
      expect(result.success).toBe(false);
    });

    it('devrait rejeter une URL de lien invalide', () => {
      const article = {
        id: 'article-123',
        sourceId: 'source-456',
        titre: 'Mon article',
        lien: 'pas-une-url',
        datePublication: new Date(),
        resume: null,
        urlImage: null,
        auteur: null,
        metaOpenGraph: {},
        metaTwitter: {},
        hashContenu: null,
        dateExtraction: new Date(),
      };

      const result = schemaArticle.safeParse(article);
      expect(result.success).toBe(false);
    });
  });

  describe('tronquerResume', () => {
    it('devrait retourner null pour un résumé null', () => {
      expect(tronquerResume(null)).toBeNull();
    });

    it('devrait garder un résumé court intact', () => {
      const shortResume = 'Ceci est un court résumé.';
      expect(tronquerResume(shortResume)).toBe(shortResume);
    });

    it('devrait tronquer un résumé trop long', () => {
      const longResume = 'A'.repeat(300);
      const result = tronquerResume(longResume);

      expect(result).not.toBeNull();
      expect(result!.length).toBe(MAX_LONGUEUR_RESUME);
      expect(result!.endsWith('...')).toBe(true);
    });

    it('devrait respecter la longueur maximale', () => {
      const exactResume = 'A'.repeat(MAX_LONGUEUR_RESUME);
      expect(tronquerResume(exactResume)).toBe(exactResume);
    });
  });

  describe('hashContenu', () => {
    it('devrait générer un hash de 32 caractères', async () => {
      const article = {
        titre: 'Mon article',
        lien: 'https://example.com/article',
        datePublication: new Date(),
        resume: null,
        urlImage: null,
        auteur: null,
      };

      const hash = await hashContenu(article);
      expect(hash).toHaveLength(32);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });

    it('devrait générer le même hash pour le même contenu', async () => {
      const article = {
        titre: 'Même titre',
        lien: 'https://example.com/same',
        datePublication: new Date(),
        resume: null,
        urlImage: null,
        auteur: null,
      };

      const hash1 = await hashContenu(article);
      const hash2 = await hashContenu(article);
      expect(hash1).toBe(hash2);
    });

    it('devrait générer des hashs différents pour des contenus différents', async () => {
      const article1 = {
        titre: 'Article 1',
        lien: 'https://example.com/1',
        datePublication: null,
        resume: null,
        urlImage: null,
        auteur: null,
      };

      const article2 = {
        titre: 'Article 2',
        lien: 'https://example.com/2',
        datePublication: null,
        resume: null,
        urlImage: null,
        auteur: null,
      };

      const hash1 = await hashContenu(article1);
      const hash2 = await hashContenu(article2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('selectionnerImage', () => {
    const articleBase = {
      titre: 'Test',
      lien: 'https://example.com',
      datePublication: null,
      resume: null,
      urlImage: 'https://example.com/rss-image.jpg',
      auteur: null,
    };

    it('devrait prioriser l\'image Open Graph', () => {
      const result = selectionnerImage(articleBase, {
        openGraph: { image: 'https://example.com/og-image.jpg' },
        twitter: { image: 'https://example.com/twitter-image.jpg' },
      });

      expect(result).toBe('https://example.com/og-image.jpg');
    });

    it('devrait utiliser l\'image Twitter si pas d\'Open Graph', () => {
      const result = selectionnerImage(articleBase, {
        openGraph: {},
        twitter: { image: 'https://example.com/twitter-image.jpg' },
      });

      expect(result).toBe('https://example.com/twitter-image.jpg');
    });

    it('devrait utiliser l\'image RSS si pas de métadonnées', () => {
      const result = selectionnerImage(articleBase, {
        openGraph: {},
        twitter: {},
      });

      expect(result).toBe('https://example.com/rss-image.jpg');
    });

    it('devrait retourner null si aucune image disponible', () => {
      const articleSansImage = { ...articleBase, urlImage: null };
      const result = selectionnerImage(articleSansImage, {
        openGraph: {},
        twitter: {},
      });

      expect(result).toBeNull();
    });
  });

  describe('selectionnerResume', () => {
    const articleBase = {
      titre: 'Test',
      lien: 'https://example.com',
      datePublication: null,
      resume: 'Résumé RSS',
      urlImage: null,
      auteur: null,
    };

    it('devrait prioriser la description Open Graph', () => {
      const result = selectionnerResume(articleBase, {
        openGraph: { description: 'Description OG' },
        twitter: { description: 'Description Twitter' },
      });

      expect(result).toBe('Description OG');
    });

    it('devrait utiliser la description Twitter si pas d\'Open Graph', () => {
      const result = selectionnerResume(articleBase, {
        openGraph: {},
        twitter: { description: 'Description Twitter' },
      });

      expect(result).toBe('Description Twitter');
    });

    it('devrait utiliser le résumé RSS si pas de métadonnées', () => {
      const result = selectionnerResume(articleBase, {
        openGraph: {},
        twitter: {},
      });

      expect(result).toBe('Résumé RSS');
    });

    it('devrait tronquer un résumé trop long', () => {
      const result = selectionnerResume(articleBase, {
        openGraph: { description: 'A'.repeat(300) },
      });

      expect(result).not.toBeNull();
      expect(result!.length).toBe(MAX_LONGUEUR_RESUME);
      expect(result!.endsWith('...')).toBe(true);
    });
  });
});
