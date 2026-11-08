/**
 * Veilleur - Mise à jour de l'application : rechargement quand un nouveau
 * service worker prend le contrôle, recherche de mise à jour au retour sur l'onglet
 */

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { surveillerMiseAJour, INTERVALLE_VERIFICATION_MS } from '@/client/utils/miseAJourApp';

function fauxConteneur(controller: object | null) {
  const cible = new EventTarget() as EventTarget & { controller: object | null };
  cible.controller = controller;
  return cible as unknown as ServiceWorkerContainer;
}

function fausseInscription() {
  return { update: vi.fn().mockResolvedValue(undefined) } as unknown as ServiceWorkerRegistration;
}

function rendreVisible(etat: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: etat, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('surveillerMiseAJour', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('recharge une seule fois quand un nouveau worker remplace l\'ancien', () => {
    const conteneur = fauxConteneur({});
    const recharger = vi.fn();
    surveillerMiseAJour({ conteneur, inscription: fausseInscription(), recharger });
    conteneur.dispatchEvent(new Event('controllerchange'));
    conteneur.dispatchEvent(new Event('controllerchange'));
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('ne recharge pas à la première installation (pas de worker précédent)', () => {
    const conteneur = fauxConteneur(null);
    const recharger = vi.fn();
    surveillerMiseAJour({ conteneur, inscription: fausseInscription(), recharger });
    conteneur.dispatchEvent(new Event('controllerchange'));
    expect(recharger).not.toHaveBeenCalled();
  });

  it('cherche une mise à jour quand l\'onglet redevient visible, au plus une fois par intervalle', () => {
    const inscription = fausseInscription();
    surveillerMiseAJour({ conteneur: fauxConteneur({}), inscription, recharger: vi.fn() });
    // Juste après le chargement, le navigateur vient de vérifier : rien à faire
    rendreVisible('visible');
    rendreVisible('hidden');
    expect(inscription.update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(INTERVALLE_VERIFICATION_MS + 1);
    rendreVisible('visible');
    rendreVisible('visible');
    expect(inscription.update).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(INTERVALLE_VERIFICATION_MS + 1);
    rendreVisible('visible');
    expect(inscription.update).toHaveBeenCalledTimes(2);
  });

  it('ignore un échec de la vérification', async () => {
    const inscription = { update: vi.fn().mockRejectedValue(new Error('hors ligne')) } as unknown as ServiceWorkerRegistration;
    surveillerMiseAJour({ conteneur: fauxConteneur({}), inscription, recharger: vi.fn() });
    vi.advanceTimersByTime(INTERVALLE_VERIFICATION_MS + 1);
    rendreVisible('visible');
    await vi.runAllTimersAsync();
    expect(inscription.update).toHaveBeenCalledTimes(1);
  });
});
