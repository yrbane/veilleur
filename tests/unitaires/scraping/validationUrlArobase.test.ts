/**
 * Veilleur - Le « @ » n'est interdit que dans l'autorité (identifiants), pas dans le chemin (Mastodon)
 */

import { describe, it, expect } from 'vitest';
import { validerUrlScraping } from '@/infrastructure/scraping/validationUrl';

describe('validerUrlScraping — arobase', () => {
  it('refuse des identifiants devant l\'hôte', () => {
    expect(validerUrlScraping('https://user:motdepasse@exemple.org/flux').valide).toBe(false);
    expect(validerUrlScraping('https://exemple.org@127.0.0.1/').valide).toBe(false);
  });

  it('accepte un « @ » dans le chemin', () => {
    const resultat = validerUrlScraping('https://cyberplace.social/@GossiTheDog/117528831681803563');
    expect(resultat.valide).toBe(true);
    expect(resultat.urlNormalisee).toContain('/@GossiTheDog/');
  });
});
