/**
 * Veilleur - Extraction automatique des mots-clés d'un article
 */

import { describe, it, expect } from 'vitest';
import { extraireMotsCles, NOMBRE_MOTS_CLES } from '@/domaine/services/ExtractionMotsCles';

describe('extraireMotsCles', () => {
  it('retourne au plus cinq mots-clés, sans mots vides ni mots courts', () => {
    const mots = extraireMotsCles({
      titre: 'La réforme des retraites divise le gouvernement et les syndicats',
      resume: 'Le gouvernement a présenté la réforme des retraites. Les syndicats appellent à la grève contre cette réforme, que le gouvernement défend.',
    });

    expect(mots.length).toBeLessThanOrEqual(NOMBRE_MOTS_CLES);
    expect(mots).not.toContain('le');
    expect(mots).not.toContain('les');
    expect(mots).not.toContain('cette');
    expect(mots).toContain('réforme');
    expect(mots).toContain('gouvernement');
  });

  it('pondère le titre et classe par importance', () => {
    const mots = extraireMotsCles({
      titre: 'Inondations à Valence',
      resume: 'Des pluies torrentielles ont frappé la région. Les habitants nettoient les rues. Les pluies continuent.',
    });

    // « inondations » n'apparaît qu'une fois mais dans le titre : il passe devant « pluies » (deux fois dans le résumé)
    expect(mots.indexOf('inondation')).toBeLessThan(mots.indexOf('pluie'));
  });

  it('conserve la majuscule des noms propres et met le reste en minuscules', () => {
    const mots = extraireMotsCles({
      titre: 'Emmanuel Macron reçoit les maires',
      resume: 'Le président Macron a réuni les maires à Paris. Les Maires attendent des réponses.',
    });

    expect(mots).toContain('Macron');
    expect(mots).toContain('Paris');
    expect(mots).toContain('maire');
    expect(mots).not.toContain('Le');
  });

  it('regroupe singulier et pluriel sous une seule entrée', () => {
    const mots = extraireMotsCles({ titre: 'Manifestation', resume: 'Des manifestations ont eu lieu. La manifestation a rassemblé des milliers de manifestants.' });

    expect(mots.filter(m => m.startsWith('manifestation'))).toHaveLength(1);
  });

  it('filtre aussi les mots vides anglais', () => {
    const mots = extraireMotsCles({ titre: 'The government announces new climate measures', resume: 'The measures will be presented to the parliament with the support of the ministers.' });

    expect(mots).not.toContain('the');
    expect(mots).not.toContain('with');
    expect(mots).toContain('climate');
  });

  it('ne singularise ni les finales invariables en -ès ni les noms propres', () => {
    const mots = extraireMotsCles({
      titre: 'Au procès de Limoges, le succès des avocats',
      resume: 'Le procès se tient à Limoges. Les avocats saluent un succès.',
    });

    expect(mots).toContain('procès');
    expect(mots).toContain('Limoges');
    expect(mots).toContain('succès');
    expect(mots).toContain('avocat');
  });

  it('écarte les mots creux des titres de presse', () => {
    const mots = extraireMotsCles({ titre: 'Pourquoi et comment les gens font face à la canicule', resume: null });

    expect(mots).toEqual(['canicule']);
  });

  it('retourne une liste vide sans texte exploitable', () => {
    expect(extraireMotsCles({ titre: '', resume: null })).toEqual([]);
    expect(extraireMotsCles({ titre: 'Le la les', resume: 'de du des' })).toEqual([]);
  });

  it('ignore les nombres et les restes d\'URL', () => {
    const mots = extraireMotsCles({ titre: '2026 : bilan', resume: 'Voir https://exemple.fr/article-123 pour le bilan complet du budget 2026.' });

    expect(mots).not.toContain('2026');
    expect(mots).not.toContain('https');
    expect(mots).toContain('bilan');
  });
});
