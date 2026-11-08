/**
 * Veilleur - Mise à jour de l'application installée
 * Quand un nouveau service worker remplace l'ancien, la page se recharge pour
 * exécuter le code de la nouvelle version ; un onglet laissé ouvert longtemps
 * vérifie s'il existe une mise à jour chaque fois qu'il redevient visible.
 */

/** Délai minimal entre deux vérifications de mise à jour */
export const INTERVALLE_VERIFICATION_MS = 5 * 60 * 1000;

export interface DependancesMiseAJour {
  conteneur: ServiceWorkerContainer;
  inscription: ServiceWorkerRegistration;
  recharger: () => void;
  document?: Document;
}

export function surveillerMiseAJour({ conteneur, inscription, recharger, document: doc = document }: DependancesMiseAJour): void {
  // Sans worker précédent (première visite), la prise de contrôle n'est pas une mise à jour
  const avaitControleur = conteneur.controller !== null;
  let dejaRecharge = false;
  conteneur.addEventListener('controllerchange', () => {
    if (!avaitControleur || dejaRecharge) return;
    dejaRecharge = true;
    recharger();
  });

  let derniereVerification = Date.now();
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState !== 'visible') return;
    const maintenant = Date.now();
    if (maintenant - derniereVerification < INTERVALLE_VERIFICATION_MS) return;
    derniereVerification = maintenant;
    // L'échec (hors ligne, worker indisponible) est sans conséquence
    try {
      void inscription.update().catch(() => undefined);
    } catch {
      // worker déjà désinscrit
    }
  });
}
