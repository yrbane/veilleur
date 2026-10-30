/**
 * Veilleur - Tests de l'en-tête de table triable (clic, ordre, accessibilité)
 */

// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { creerEnteteTriable, basculerTri, type EtatTri } from '@/client/utils/tableTriable';

const colonnes = [
  { cle: 'email', libelle: 'Compte' },
  { cle: 'nombreSources', libelle: 'Sources', numerique: true },
  { libelle: 'Actions' },
];

describe('creerEnteteTriable', () => {
  it('rend un bouton par colonne triable et marque la colonne active', () => {
    const thead = creerEnteteTriable(colonnes, { tri: 'email', ordre: 'asc' }, () => {});
    const ths = thead.querySelectorAll('th');
    expect(ths).toHaveLength(3);
    expect(ths[0]!.getAttribute('aria-sort')).toBe('ascending');
    expect(ths[1]!.getAttribute('aria-sort')).toBe('none');
    expect(ths[2]!.getAttribute('aria-sort')).toBeNull();
    expect(ths[0]!.querySelector('button')).not.toBeNull();
    expect(ths[2]!.querySelector('button')).toBeNull();
    expect(ths[1]!.classList.contains('num')).toBe(true);
  });

  it('signale le nouveau tri au clic', () => {
    const onTri = vi.fn();
    const thead = creerEnteteTriable(colonnes, { tri: 'email', ordre: 'asc' }, onTri);
    thead.querySelectorAll('button')[1]!.click();
    expect(onTri).toHaveBeenCalledWith({ tri: 'nombreSources', ordre: 'desc' });
    thead.querySelectorAll('button')[0]!.click();
    expect(onTri).toHaveBeenCalledWith({ tri: 'email', ordre: 'desc' });
  });
});

describe('basculerTri', () => {
  it('inverse l\'ordre sur la même colonne, sinon part de l\'ordre naturel', () => {
    const etat: EtatTri = { tri: 'email', ordre: 'asc' };
    expect(basculerTri(etat, colonnes[0]!)).toEqual({ tri: 'email', ordre: 'desc' });
    expect(basculerTri(etat, colonnes[1]!)).toEqual({ tri: 'nombreSources', ordre: 'desc' });
    expect(basculerTri({ tri: 'nombreSources', ordre: 'desc' }, colonnes[0]!)).toEqual({ tri: 'email', ordre: 'asc' });
  });
});
