/**
 * Veilleur - Courriel « Mot de passe oublié »
 */

import { describe, it, expect } from 'vitest';
import { composerCourrielReinitialisation } from '@/domaine/services/CourrielReinitialisation';

describe('composerCourrielReinitialisation', () => {
  const courriel = composerCourrielReinitialisation({
    destinataire: 'marie@example.org',
    urlLien: 'https://news.example/reinitialiser-mot-de-passe?token=abc<def',
    dureeMinutes: 60,
  });

  it('adresse le courriel au destinataire avec un sujet explicite', () => {
    expect(courriel.a).toBe('marie@example.org');
    expect(courriel.sujet).toMatch(/mot de passe/i);
  });

  it('porte le lien et la durée de validité en texte et en HTML (échappé)', () => {
    expect(courriel.texte).toContain('https://news.example/reinitialiser-mot-de-passe?token=abc<def');
    expect(courriel.texte).toContain('60 minutes');
    expect(courriel.html).toContain('token=abc&lt;def');
    expect(courriel.html).not.toContain('abc<def');
    expect(courriel.html).toContain('60 minutes');
  });

  it('rassure celui qui n\'a rien demandé', () => {
    expect(courriel.texte).toMatch(/ignorer/i);
  });
});
