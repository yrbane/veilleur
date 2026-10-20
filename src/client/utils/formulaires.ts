/**
 * Veilleur - Confort des formulaires
 */

import { icone } from './icones';

/**
 * Ajoute à chaque champ mot de passe du formulaire un bouton œil pour afficher la saisie
 */
export function ajouterBasculeMotDePasse(formulaire: HTMLElement): void {
  formulaire.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((champ) => {
    if (champ.parentElement?.classList.contains('champ-mdp')) return;

    const enveloppe = document.createElement('div');
    enveloppe.className = 'champ-mdp';
    champ.replaceWith(enveloppe);
    enveloppe.append(champ);

    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'btn-visibilite';
    const rafraichir = (visible: boolean) => {
      bouton.replaceChildren(icone(visible ? 'visibility_off' : 'visibility'));
      bouton.setAttribute('aria-label', visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      bouton.setAttribute('aria-pressed', String(visible));
      bouton.title = bouton.getAttribute('aria-label') ?? '';
    };
    rafraichir(false);
    bouton.addEventListener('click', () => {
      const visible = champ.type === 'password';
      champ.type = visible ? 'text' : 'password';
      rafraichir(visible);
      champ.focus();
    });
    enveloppe.append(bouton);
  });
}
