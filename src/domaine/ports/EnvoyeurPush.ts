/**
 * Veilleur - Port : envoi d'une notification Web Push
 */

import type { AbonnementPush } from './DepotNotifications';

export interface ChargePush {
  titre: string;
  corps: string;
  /** Chemin ouvert au clic, relatif à l'application */
  url: string;
  /** Regroupe les notifications de même nature */
  tag?: string;
}

/** « expire » : l'abonnement n'existe plus côté navigateur (404/410), à supprimer */
export type ResultatEnvoiPush = 'envoye' | 'expire' | 'echec';

export interface EnvoyeurPush {
  estConfigure(): boolean;
  envoyer(abonnement: AbonnementPush, charge: ChargePush): Promise<ResultatEnvoiPush>;
}
