/**
 * Veilleur - Tests de la résolution du tri des listes d'administration (liste blanche de colonnes)
 */

import { describe, it, expect } from 'vitest';
import { resoudreTri, TRIS_UTILISATEURS, TRIS_SOURCES } from '@/domaine/services/ServiceAdministration';

describe('resoudreTri', () => {
  it('retombe sur le tri par défaut quand la clé est inconnue ou absente', () => {
    expect(resoudreTri(TRIS_UTILISATEURS, undefined, undefined)).toEqual({ expression: TRIS_UTILISATEURS.defaut.expression, ordre: 'desc' });
    expect(resoudreTri(TRIS_UTILISATEURS, 'DROP TABLE', 'asc')).toEqual({ expression: TRIS_UTILISATEURS.defaut.expression, ordre: 'asc' });
  });

  it('accepte une colonne connue et un ordre explicite', () => {
    expect(resoudreTri(TRIS_UTILISATEURS, 'email', 'asc')).toEqual({ expression: 'u.email', ordre: 'asc' });
    expect(resoudreTri(TRIS_SOURCES, 'articles', 'desc')).toEqual({ expression: 'articles', ordre: 'desc' });
  });

  it('applique l\'ordre naturel de la colonne quand l\'ordre n\'est pas précisé', () => {
    // Les compteurs se lisent du plus grand au plus petit, les libellés de A à Z
    expect(resoudreTri(TRIS_SOURCES, 'nom', undefined).ordre).toBe('asc');
    expect(resoudreTri(TRIS_SOURCES, 'nombreEchecs', undefined).ordre).toBe('desc');
  });

  it('expose les colonnes triables des deux listes', () => {
    expect(Object.keys(TRIS_UTILISATEURS.colonnes)).toEqual(expect.arrayContaining(['email', 'role', 'dateCreation', 'dateDerniereConnexion', 'nombreSources', 'nombreLectures']));
    expect(Object.keys(TRIS_SOURCES.colonnes)).toEqual(expect.arrayContaining(['nom', 'typeSource', 'statut', 'nombreEchecs', 'abonnes', 'articles', 'dateDerniereSynchro']));
  });
});
