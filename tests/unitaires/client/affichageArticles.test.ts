// @vitest-environment jsdom
/**
 * Veilleur - Affichage du fil : liste (une carte par ligne) ou tuiles (grille)
 * Le choix est mémorisé dans le navigateur et appliqué au conteneur du fil.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { modeEnregistre, enregistrerMode, appliquerMode, creerSelecteurAffichage, CLE_AFFICHAGE } from '@/client/utils/affichageArticles';

describe('mode d\'affichage mémorisé', () => {
  beforeEach(() => localStorage.clear());

  it('vaut « liste » par défaut et ignore une valeur inconnue', () => {
    expect(modeEnregistre()).toBe('liste');
    localStorage.setItem(CLE_AFFICHAGE, 'mosaique');
    expect(modeEnregistre()).toBe('liste');
  });

  it('mémorise « tuiles » et le relit', () => {
    enregistrerMode('tuiles');
    expect(modeEnregistre()).toBe('tuiles');
  });
});

describe('appliquerMode', () => {
  it('pose ou retire la classe tuiles sur le conteneur', () => {
    const conteneur = document.createElement('div');
    appliquerMode(conteneur, 'tuiles');
    expect(conteneur.classList.contains('tuiles')).toBe(true);
    expect(conteneur.dataset.affichage).toBe('tuiles');
    appliquerMode(conteneur, 'liste');
    expect(conteneur.classList.contains('tuiles')).toBe(false);
    expect(conteneur.dataset.affichage).toBe('liste');
  });
});

describe('creerSelecteurAffichage', () => {
  it('propose deux boutons, marque le mode courant et signale le changement', () => {
    const onChange = vi.fn();
    const selecteur = creerSelecteurAffichage('liste', onChange);
    const boutons = selecteur.querySelectorAll<HTMLButtonElement>('button');

    expect(boutons).toHaveLength(2);
    expect(boutons[0].getAttribute('aria-pressed')).toBe('true');
    expect(boutons[1].getAttribute('aria-pressed')).toBe('false');
    expect(selecteur.getAttribute('role')).toBe('group');

    boutons[1].click();

    expect(onChange).toHaveBeenCalledWith('tuiles');
    expect(boutons[1].getAttribute('aria-pressed')).toBe('true');
    expect(boutons[0].getAttribute('aria-pressed')).toBe('false');
    expect(modeEnregistre()).toBe('tuiles');
  });

  it('ne signale rien quand on reclique le mode déjà actif', () => {
    const onChange = vi.fn();
    const selecteur = creerSelecteurAffichage('tuiles', onChange);
    selecteur.querySelectorAll<HTMLButtonElement>('button')[1].click();
    expect(onChange).not.toHaveBeenCalled();
  });
});
