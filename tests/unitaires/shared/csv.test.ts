/**
 * Veilleur - Export CSV
 */

import { describe, it, expect } from 'vitest';
import { citerChampCsv, formaterCsv } from '@/shared/utils/csv';

describe('citerChampCsv', () => {
  it('laisse les valeurs simples telles quelles et vide les absentes', () => {
    expect(citerChampCsv('Bonjour')).toBe('Bonjour');
    expect(citerChampCsv(4)).toBe('4');
    expect(citerChampCsv(true)).toBe('true');
    expect(citerChampCsv(null)).toBe('');
    expect(citerChampCsv(undefined)).toBe('');
  });

  it('cite les champs contenant un séparateur, un guillemet ou un retour à la ligne', () => {
    expect(citerChampCsv('a;b')).toBe('"a;b"');
    expect(citerChampCsv('Il a dit "oui"')).toBe('"Il a dit ""oui"""');
    expect(citerChampCsv('ligne 1\nligne 2')).toBe('"ligne 1\nligne 2"');
  });

  it('sérialise les dates en ISO', () => {
    expect(citerChampCsv(new Date('2026-10-21T08:00:00Z'))).toBe('2026-10-21T08:00:00.000Z');
  });
});

describe('formaterCsv', () => {
  it('produit en-tête et lignes dans l\'ordre des colonnes, avec BOM et CRLF', () => {
    const csv = formaterCsv(
      [
        { titre: 'Un; deux', note: 4, favori: true },
        { titre: 'Trois', note: null, favori: false },
      ],
      ['titre', 'note', 'favori'],
    );

    expect(csv).toBe('﻿titre;note;favori\r\n"Un; deux";4;true\r\nTrois;;false\r\n');
  });

  it('ne renvoie que l\'en-tête sans ligne', () => {
    expect(formaterCsv([], ['a', 'b'])).toBe('﻿a;b\r\n');
  });
});
