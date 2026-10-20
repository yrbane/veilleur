/**
 * Veilleur - Déduction automatique des tags d'une source à son ajout
 */

import { describe, it, expect } from 'vitest';
import { deduireTagsSource, NOMBRE_TAGS_SOURCE } from '@/domaine/services/ExtractionTagsSource';

describe('deduireTagsSource', () => {
  it('reprend les catégories déclarées par le flux, dans l\'ordre', () => {
    const tags = deduireTagsSource({ categoriesFlux: ['Politique', 'Écologie', 'International'] });

    expect(tags).toEqual(['Politique', 'Écologie', 'International']);
  });

  it('complète avec les catégories les plus fréquentes des articles', () => {
    const tags = deduireTagsSource({
      categoriesFlux: ['Politique'],
      categoriesArticles: [['Économie', 'Social'], ['Économie'], ['Culture'], ['Économie', 'Social']],
    });

    expect(tags).toEqual(['Politique', 'Économie', 'Social', 'Culture']);
  });

  it('limite le nombre de tags et dédoublonne sans tenir compte de la casse ni des accents', () => {
    const tags = deduireTagsSource({
      categoriesFlux: ['Politique', 'politique', 'POLITIQUE', 'Ecologie', 'Écologie', 'Santé', 'Sport', 'Culture', 'Justice'],
    });

    expect(tags).toHaveLength(NOMBRE_TAGS_SOURCE);
    expect(tags).toEqual(['Politique', 'Ecologie', 'Santé', 'Sport', 'Culture']);
  });

  it('écarte les catégories creuses, trop longues ou qui ressemblent à une URL', () => {
    const tags = deduireTagsSource({
      categoriesFlux: ['Actualités', 'Uncategorized', 'Non classé', 'À la une', 'https://exemple.fr/cat', 'Une catégorie beaucoup trop longue pour servir de tag ici', 'Sciences'],
    });

    expect(tags).toEqual(['Sciences']);
  });

  it('utilise les mots-clés de la page quand le flux n\'a aucune catégorie', () => {
    const tags = deduireTagsSource({ motsClesPage: 'astronomie, espace, physique' });

    expect(tags).toEqual(['astronomie', 'espace', 'physique']);
  });

  it('retombe sur les mots-clés extraits des titres d\'articles, sinon rien', () => {
    const tags = deduireTagsSource({
      titresArticles: ['Les lycéens manifestent contre la réforme', 'Réforme des lycées : les lycéens dans la rue', 'La réforme contestée'],
    });

    expect(tags[0]).toBe('réforme');
    expect(tags).toContain('lycéen');
    expect(deduireTagsSource({})).toEqual([]);
  });
});
