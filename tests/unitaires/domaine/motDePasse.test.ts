/**
 * Veilleur - Hachage des mots de passe (scrypt) partagé entre l'authentification
 * et la réinitialisation
 */

import { describe, it, expect } from 'vitest';
import { hasherMotDePasse, verifierMotDePasse, validerForceMotDePasse } from '@/domaine/services/motDePasse';

describe('hasherMotDePasse / verifierMotDePasse', () => {
  it('produit un hachage versionné v2 vérifiable, différent à chaque appel (sel)', async () => {
    const h1 = await hasherMotDePasse('Secret!2026');
    const h2 = await hasherMotDePasse('Secret!2026');
    expect(h1.startsWith('v2:16384:8:1:')).toBe(true);
    expect(h1).not.toBe(h2);
    expect(await verifierMotDePasse('Secret!2026', h1)).toBe(true);
    expect(await verifierMotDePasse('autre', h1)).toBe(false);
  });

  it('refuse un hachage mal formé sans lever', async () => {
    expect(await verifierMotDePasse('x', 'n-importe-quoi')).toBe(false);
    expect(await verifierMotDePasse('x', 'v2:a:b:c')).toBe(false);
  });
});

describe('validerForceMotDePasse', () => {
  it('exige longueur, majuscule, minuscule, chiffre et caractère spécial', () => {
    expect(validerForceMotDePasse('Secret!2026').valide).toBe(true);
    const faible = validerForceMotDePasse('court');
    expect(faible.valide).toBe(false);
    expect(faible.erreurs.length).toBeGreaterThan(1);
  });
});
