/**
 * Veilleur - Assemblage du service de notifications (push + courriel)
 */

import { env } from '@/config/environnement';
import { ServiceNotifications } from '@/domaine/services/ServiceNotifications';
import { DepotNotificationsMariaDB } from '@/infrastructure/persistence/DepotNotificationsMariaDB';
import { DepotArticlesMariaDB } from '@/infrastructure/persistence/DepotArticlesMariaDB';
import { obtenirServiceCache } from '@/infrastructure/cache/ServiceCacheRedis';
import { EnvoyeurPushWeb } from './EnvoyeurPushWeb';
import { EnvoyeurCourrielSmtp } from '../courriel/EnvoyeurCourrielSmtp';

let envoyeurPush: EnvoyeurPushWeb | null = null;
let service: ServiceNotifications | null = null;

export function obtenirEnvoyeurPush(): EnvoyeurPushWeb {
  if (!envoyeurPush) {
    envoyeurPush = new EnvoyeurPushWeb({ clePublique: env.VAPID_PUBLIC_KEY, clePrivee: env.VAPID_PRIVATE_KEY, sujet: env.VAPID_SUBJECT });
  }
  return envoyeurPush;
}

export function obtenirEnvoyeurCourriel(): EnvoyeurCourrielSmtp {
  return new EnvoyeurCourrielSmtp({
    hote: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    utilisateur: env.SMTP_USER,
    motDePasse: env.SMTP_PASSWORD,
    expediteur: env.SMTP_FROM,
  });
}

export function obtenirServiceNotifications(): ServiceNotifications {
  if (!service) {
    service = new ServiceNotifications(
      new DepotNotificationsMariaDB(),
      new DepotArticlesMariaDB(),
      obtenirEnvoyeurPush(),
      obtenirEnvoyeurCourriel(),
      obtenirServiceCache(),
      { intervallePushS: env.NOTIFICATIONS_PUSH_INTERVALLE_MIN * 60, urlApp: env.APP_URL },
    );
  }
  return service;
}
