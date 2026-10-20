// @vitest-environment jsdom
/**
 * Veilleur - Bascule de visibilité des mots de passe
 */

import { describe, it, expect } from 'vitest';
import { ajouterBasculeMotDePasse } from '@/client/utils/formulaires';

describe('ajouterBasculeMotDePasse', () => {
  it('ajoute un bouton qui affiche puis masque le mot de passe', () => {
    document.body.innerHTML = '<form><input type="password" id="mdp" class="la-input"></form>';
    const form = document.querySelector('form')!;

    ajouterBasculeMotDePasse(form);

    const champ = document.querySelector<HTMLInputElement>('#mdp')!;
    const bouton = form.querySelector<HTMLButtonElement>('button.btn-visibilite')!;
    expect(bouton.getAttribute('aria-label')).toBe('Afficher le mot de passe');
    expect(bouton.getAttribute('aria-pressed')).toBe('false');
    bouton.click();
    expect(champ.type).toBe('text');
    expect(bouton.getAttribute('aria-label')).toBe('Masquer le mot de passe');
    expect(bouton.getAttribute('aria-pressed')).toBe('true');
    bouton.click();
    expect(champ.type).toBe('password');
  });

  it('ne soumet pas le formulaire et traite chaque champ une seule fois', () => {
    document.body.innerHTML = '<form><input type="password" id="a"><input type="password" id="b"></form>';
    const form = document.querySelector('form')!;

    ajouterBasculeMotDePasse(form);
    ajouterBasculeMotDePasse(form);

    const boutons = form.querySelectorAll('button.btn-visibilite');
    expect(boutons).toHaveLength(2);
    expect(boutons[0].getAttribute('type')).toBe('button');
  });
});
