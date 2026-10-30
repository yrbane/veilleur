/**
 * Veilleur - Tests des sections de la page Paramètres selon le rôle et l'ancre
 */

import { describe, it, expect } from 'vitest';
import { sectionsPour, sectionDepuisHash, SECTIONS_COMPTE, SECTIONS_ADMIN } from '@/client/utils/sectionsParametres';

describe('sectionsPour', () => {
  it('ne montre les sections d\'administration qu\'aux administrateurs', () => {
    expect(sectionsPour('membre').map(s => s.groupe)).not.toContain('admin');
    expect(sectionsPour(undefined)).toEqual(SECTIONS_COMPTE);
    expect(sectionsPour('admin')).toEqual([...SECTIONS_COMPTE, ...SECTIONS_ADMIN]);
  });

  it('a des identifiants uniques', () => {
    const ids = sectionsPour('admin').map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('sectionDepuisHash', () => {
  it('retrouve la section de l\'ancre, sinon la première', () => {
    expect(sectionDepuisHash('#securite', sectionsPour('membre')).id).toBe('securite');
    expect(sectionDepuisHash('', sectionsPour('membre')).id).toBe('compte');
    // Un membre qui tape #apercu retombe sur son compte
    expect(sectionDepuisHash('#apercu', sectionsPour('membre')).id).toBe('compte');
    expect(sectionDepuisHash('#apercu', sectionsPour('admin')).id).toBe('apercu');
  });
});
