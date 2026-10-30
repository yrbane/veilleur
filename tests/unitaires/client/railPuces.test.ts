/**
 * Veilleur - Tests du rail de puces (rubriques, tendances, mots-clés sur une ligne dépliable)
 */

// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { creerRailPuces } from '@/client/composants/RailPuces';

function puce(texte: string): HTMLElement {
  const b = document.createElement('button');
  b.className = 'la-chip chip-filtre';
  b.textContent = texte;
  return b;
}

describe('creerRailPuces', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('crée un groupe par définition, avec son conteneur identifié', () => {
    const rail = creerRailPuces({
      libelle: 'Filtres rapides',
      groupes: [
        { id: 'fil-rubriques', icone: 'label', titre: 'Rubriques' },
        { id: 'fil-tendances', icone: 'local_fire_department', titre: 'Tendances' },
      ],
    });
    document.body.append(rail);
    expect(rail.getAttribute('aria-label')).toBe('Filtres rapides');
    expect(rail.querySelectorAll('.rail-groupe')).toHaveLength(2);
    expect(rail.querySelector('#fil-rubriques')).not.toBeNull();
    expect(rail.querySelector('#fil-tendances')?.closest('.rail-groupe')?.getAttribute('aria-label')).toBe('Tendances');
  });

  it('masque les groupes vides et le rail entier quand tout est vide', () => {
    const rail = creerRailPuces({ libelle: 'x', groupes: [{ id: 'a', icone: 'label', titre: 'A' }, { id: 'b', icone: 'tag', titre: 'B' }] });
    document.body.append(rail);
    rail.actualiser();
    expect(rail.classList.contains('masque')).toBe(true);

    rail.querySelector('#a')!.append(puce('un'));
    rail.actualiser();
    expect(rail.classList.contains('masque')).toBe(false);
    expect(rail.querySelector('#a')!.closest('.rail-groupe')!.classList.contains('masque')).toBe(false);
    expect(rail.querySelector('#b')!.closest('.rail-groupe')!.classList.contains('masque')).toBe(true);
  });

  it('se déplie et se replie, en le disant au bouton', () => {
    const rail = creerRailPuces({ libelle: 'x', groupes: [{ id: 'a', icone: 'label', titre: 'A' }] });
    document.body.append(rail);
    const bouton = rail.querySelector('.rail-deplier') as HTMLButtonElement;
    expect(rail.classList.contains('deplie')).toBe(false);
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    bouton.click();
    expect(rail.classList.contains('deplie')).toBe(true);
    expect(bouton.getAttribute('aria-expanded')).toBe('true');
    bouton.click();
    expect(rail.classList.contains('deplie')).toBe(false);
  });
});
