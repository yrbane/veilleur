/**
 * Veilleur - Envoi Web Push (protocole VAPID) via la bibliothèque web-push
 */

import webPush from 'web-push';
import type { AbonnementPush } from '@/domaine/ports/DepotNotifications';
import type { EnvoyeurPush, ChargePush, ResultatEnvoiPush } from '@/domaine/ports/EnvoyeurPush';
import { loggerJobs } from '../logging/logger';

export interface ConfigVapid {
  clePublique?: string;
  clePrivee?: string;
  sujet: string;
}

export class EnvoyeurPushWeb implements EnvoyeurPush {
  private readonly configure: boolean;

  constructor(private readonly config: ConfigVapid) {
    this.configure = Boolean(config.clePublique && config.clePrivee);
    if (this.configure) {
      webPush.setVapidDetails(config.sujet, config.clePublique!, config.clePrivee!);
    }
  }

  estConfigure(): boolean {
    return this.configure;
  }

  clePublique(): string | null {
    return this.configure ? this.config.clePublique! : null;
  }

  async envoyer(abonnement: AbonnementPush, charge: ChargePush): Promise<ResultatEnvoiPush> {
    if (!this.configure) return 'echec';
    try {
      await webPush.sendNotification(
        { endpoint: abonnement.endpoint, keys: { p256dh: abonnement.clePublique, auth: abonnement.secretAuth } },
        JSON.stringify(charge),
        { TTL: 3600, urgency: 'normal' },
      );
      return 'envoye';
    } catch (erreur) {
      const statut = (erreur as { statusCode?: number }).statusCode;
      if (statut === 404 || statut === 410) return 'expire';
      loggerJobs.warn({ statut, endpoint: abonnement.endpoint.slice(0, 60) }, 'Échec d\'envoi Web Push');
      return 'echec';
    }
  }
}
