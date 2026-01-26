/**
 * Tests unitaires - Entité Tag
 */

import { describe, it, expect } from 'vitest';
import {
  schemaTag,
  schemaCreationTag,
  genererSlug,
  estSlugValide,
} from '@/domaine/entites/Tag';

describe('Tag', () => {
  describe('schemaTag', () => {
    it('devrait valider un tag complet', () => {
      const tag = {
        id: 'tag-123',
        nom: 'Technologie',
        slug: 'technologie',
        dateCreation: new Date(),
      };

      const result = schemaTag.safeParse(tag);
      expect(result.success).toBe(true);
    });

    it('devrait rejeter un tag sans id', () => {
      const tag = {
        nom: 'Test',
        slug: 'test',
        dateCreation: new Date(),
      };

      const result = schemaTag.safeParse(tag);
      expect(result.success).toBe(false);
    });

    it('devrait rejeter un tag avec nom trop long', () => {
      const tag = {
        id: 'tag-123',
        nom: 'a'.repeat(51),
        slug: 'test',
        dateCreation: new Date(),
      };

      const result = schemaTag.safeParse(tag);
      expect(result.success).toBe(false);
    });
  });

  describe('schemaCreationTag', () => {
    it('devrait valider un nom valide', () => {
      const result = schemaCreationTag.safeParse({ nom: 'JavaScript' });
      expect(result.success).toBe(true);
    });

    it('devrait rejeter un nom vide', () => {
      const result = schemaCreationTag.safeParse({ nom: '' });
      expect(result.success).toBe(false);
    });

    it('devrait rejeter un nom trop long', () => {
      const result = schemaCreationTag.safeParse({ nom: 'a'.repeat(51) });
      expect(result.success).toBe(false);
    });
  });

  describe('genererSlug', () => {
    it('devrait convertir en minuscules', () => {
      expect(genererSlug('JavaScript')).toBe('javascript');
    });

    it('devrait remplacer les espaces par des tirets', () => {
      expect(genererSlug('Web Development')).toBe('web-development');
    });

    it('devrait supprimer les accents', () => {
      expect(genererSlug('Développement Français')).toBe('developpement-francais');
    });

    it('devrait supprimer les caractères spéciaux', () => {
      expect(genererSlug('C++ & C#')).toBe('c-c');
    });

    it('devrait supprimer les tirets en début et fin', () => {
      expect(genererSlug('-test-')).toBe('test');
    });

    it('devrait gérer les espaces multiples', () => {
      expect(genererSlug('hello   world')).toBe('hello-world');
    });

    it('devrait tronquer à 50 caractères', () => {
      const longNom = 'a'.repeat(60);
      expect(genererSlug(longNom).length).toBe(50);
    });

    it('devrait gérer les caractères unicode', () => {
      expect(genererSlug('日本語')).toBe('');
    });
  });

  describe('estSlugValide', () => {
    it('devrait valider un slug simple', () => {
      expect(estSlugValide('javascript')).toBe(true);
    });

    it('devrait valider un slug avec tirets', () => {
      expect(estSlugValide('web-development')).toBe(true);
    });

    it('devrait valider un slug avec chiffres', () => {
      expect(estSlugValide('web3')).toBe(true);
    });

    it('devrait rejeter un slug avec majuscules', () => {
      expect(estSlugValide('JavaScript')).toBe(false);
    });

    it('devrait rejeter un slug avec espaces', () => {
      expect(estSlugValide('web development')).toBe(false);
    });

    it('devrait rejeter un slug avec caractères spéciaux', () => {
      expect(estSlugValide('c++')).toBe(false);
    });

    it('devrait rejeter un slug commençant par un tiret', () => {
      expect(estSlugValide('-test')).toBe(false);
    });

    it('devrait rejeter un slug finissant par un tiret', () => {
      expect(estSlugValide('test-')).toBe(false);
    });

    it('devrait rejeter un slug avec tirets consécutifs', () => {
      expect(estSlugValide('test--slug')).toBe(false);
    });

    it('devrait rejeter un slug trop long', () => {
      expect(estSlugValide('a'.repeat(51))).toBe(false);
    });

    it('devrait accepter un slug de 50 caractères', () => {
      expect(estSlugValide('a'.repeat(50))).toBe(true);
    });
  });
});
