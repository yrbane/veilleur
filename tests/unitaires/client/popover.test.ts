/**
 * Veilleur - Tests du menu déroulant (popover) de la barre du fil
 */

// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { creerPopover } from '@/client/composants/Popover';

function monter() {
  const contenu = document.createElement('div');
  contenu.append(document.createElement('input'));
  const popover = creerPopover({ libelle: 'Filtres', icone: 'tune', contenu });
  document.body.append(popover);
  return popover;
}

describe('creerPopover', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('est fermé au départ, avec les attributs ARIA reliés', () => {
    const popover = monter();
    const bouton = popover.declencheur;
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(bouton.getAttribute('aria-controls')).toBe(popover.panneau.id);
    expect(popover.panneau.hidden).toBe(true);
    expect(bouton.textContent).toContain('Filtres');
  });

  it('s\'ouvre et se referme au clic sur le déclencheur', () => {
    const popover = monter();
    popover.declencheur.click();
    expect(popover.panneau.hidden).toBe(false);
    expect(popover.declencheur.getAttribute('aria-expanded')).toBe('true');
    popover.declencheur.click();
    expect(popover.panneau.hidden).toBe(true);
  });

  it('se referme sur Échap et au clic en dehors, pas au clic dedans', () => {
    const popover = monter();
    popover.ouvrir();
    popover.panneau.querySelector('input')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(popover.panneau.hidden).toBe(false);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(popover.panneau.hidden).toBe(true);

    popover.ouvrir();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(popover.panneau.hidden).toBe(true);
  });

  it('affiche un badge avec le nombre de filtres actifs, masqué à zéro', () => {
    const popover = monter();
    expect(popover.querySelector('.popover-badge')).toBeNull();
    popover.definirBadge(2);
    expect(popover.querySelector('.popover-badge')?.textContent).toBe('2');
    expect(popover.declencheur.classList.contains('actif')).toBe(true);
    popover.definirBadge(0);
    expect(popover.querySelector('.popover-badge')).toBeNull();
    expect(popover.declencheur.classList.contains('actif')).toBe(false);
  });
});
