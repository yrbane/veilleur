/**
 * Veilleur - Assemblage du service « mot de passe oublié »
 */

import { env } from '@/config/environnement';
import { ServiceReinitialisationMotDePasse } from '@/domaine/services/ServiceReinitialisationMotDePasse';
import { obtenirServiceAuth } from '@/api/middlewares/authentification';
import { obtenirEnvoyeurCourriel } from '@/infrastructure/notifications/fabrique';
import { DepotUtilisateursMariaDB, DepotRefreshTokensMariaDB } from '@/infrastructure/persistence/DepotUtilisateursMariaDB';
import { DepotReinitialisationsMotDePasseMariaDB } from '@/infrastructure/persistence/DepotReinitialisationsMotDePasseMariaDB';

let service: ServiceReinitialisationMotDePasse | null = null;

export function obtenirServiceReinitialisationMotDePasse(): ServiceReinitialisationMotDePasse {
  if (!service) {
    service = new ServiceReinitialisationMotDePasse(
      new DepotUtilisateursMariaDB(),
      new DepotReinitialisationsMotDePasseMariaDB(),
      new DepotRefreshTokensMariaDB(),
      obtenirEnvoyeurCourriel(),
      obtenirServiceAuth(),
      { urlApp: env.APP_URL },
    );
  }
  return service;
}
