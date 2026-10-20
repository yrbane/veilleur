/**
 * Veilleur - Tri du fil et validation des notes d'articles
 */

import { describe, it, expect } from 'vitest';
import { resoudreTri, estNoteValide, TRIS_ARTICLES } from '@/domaine/entites/Article';

describe('resoudreTri', () => {
  it('trie par date décroissante par défaut', () => {
    expect(resoudreTri(undefined, undefined)).toEqual({ tri: 'date', ordre: 'desc' });
  });

  it('ignore un tri inconnu', () => {
    expect(resoudreTri('inconnu', 'asc')).toEqual({ tri: 'date', ordre: 'asc' });
  });

  it('met les textes en ordre croissant par défaut et les valeurs en décroissant', () => {
    expect(resoudreTri('titre')).toEqual({ tri: 'titre', ordre: 'asc' });
    expect(resoudreTri('source')).toEqual({ tri: 'source', ordre: 'asc' });
    expect(resoudreTri('note')).toEqual({ tri: 'note', ordre: 'desc' });
  });

  it('respecte un ordre explicite valide et ignore un ordre invalide', () => {
    expect(resoudreTri('note', 'asc').ordre).toBe('asc');
    expect(resoudreTri('note', 'haut').ordre).toBe('desc');
  });

  it('expose la liste des tris disponibles', () => {
    expect(TRIS_ARTICLES).toEqual(['date', 'note', 'titre', 'source']);
  });
});

describe('estNoteValide', () => {
  it('accepte les entiers de 1 à 5', () => {
    for (const note of [1, 2, 3, 4, 5]) expect(estNoteValide(note)).toBe(true);
  });

  it('refuse 0, 6, les décimaux et les non-nombres', () => {
    for (const note of [0, 6, 2.5, '3', null, undefined, NaN]) expect(estNoteValide(note)).toBe(false);
  });
});
