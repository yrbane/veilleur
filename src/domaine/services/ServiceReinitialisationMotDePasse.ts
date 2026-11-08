/**
 * Veilleur - Mot de passe oublié
 * Demande par courriel (lien à usage unique), choix d'un nouveau mot de passe,
 * révocation des sessions existantes puis connexion immédiate.
 */

import { createHash, randomBytes } from 'crypto';
import type { DepotRefreshTokens, DepotUtilisateurs } from '@/domaine/ports/DepotUtilisateurs';
import type { DepotReinitialisationsMotDePasse } from '@/domaine/ports/DepotReinitialisationsMotDePasse';
import type { EnvoyeurCourriel } from '@/domaine/ports/EnvoyeurCourriel';
import type { Utilisateur } from '@/domaine/entites/Utilisateur';
import { ErreurAuthentification, type ResultatAuthentification } from './ServiceAuthentification';
import { hasherMotDePasse, validerForceMotDePasse } from './motDePasse';
import { composerCourrielReinitialisation } from './CourrielReinitialisation';
import { reinitialiserTentatives } from '@/infrastructure/cache/verrouillageCompte';
import { logger } from '@/infrastructure/logging/logger';

/** Durée de validité du lien reçu par courriel */
export const DUREE_LIEN_MS = 60 * 60 * 1000;

/** Chemin du formulaire côté client, suivi du jeton en paramètre */
export const CHEMIN_REINITIALISATION = '/reinitialiser-mot-de-passe';

/** Ce dont le service a besoin de l'authentification : connecter l'utilisateur une fois le mot de passe changé */
export interface EmetteurTokens {
  emettreTokens(utilisateur: Utilisateur): Promise<ResultatAuthentification>;
}

export interface OptionsReinitialisation {
  urlApp: string;
  dureeLienMs?: number;
}

export function hacherToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class ServiceReinitialisationMotDePasse {
  private readonly dureeLienMs: number;

  constructor(
    private readonly depotUtilisateurs: DepotUtilisateurs,
    private readonly depotDemandes: DepotReinitialisationsMotDePasse,
    private readonly depotRefreshTokens: DepotRefreshTokens,
    private readonly envoyeur: EnvoyeurCourriel,
    private readonly emetteur: EmetteurTokens,
    private readonly options: OptionsReinitialisation,
  ) {
    this.dureeLienMs = options.dureeLienMs ?? DUREE_LIEN_MS;
  }

  /**
   * Envoie le lien de réinitialisation. Ne révèle jamais si le compte existe :
   * la réponse est la même pour un courriel inconnu ou un compte désactivé.
   */
  async demander(email: string): Promise<void> {
    const utilisateur = await this.depotUtilisateurs.trouverParEmail(email.trim().toLowerCase());
    if (!utilisateur || !utilisateur.estActif) {
      return;
    }
    if (!this.envoyeur.estConfigure()) {
      logger.warn({ utilisateurId: utilisateur.id }, 'Mot de passe oublié : courriel non configuré, aucun lien envoyé');
      return;
    }

    const token = randomBytes(32).toString('base64url');
    const dateExpiration = new Date(Date.now() + this.dureeLienMs);

    await this.depotDemandes.invaliderPourUtilisateur(utilisateur.id);
    await this.depotDemandes.creer({ utilisateurId: utilisateur.id, tokenHash: hacherToken(token), dateExpiration });

    await this.envoyeur.envoyer(composerCourrielReinitialisation({
      destinataire: utilisateur.email,
      urlLien: `${this.options.urlApp}${CHEMIN_REINITIALISATION}?token=${token}`,
      dureeMinutes: Math.round(this.dureeLienMs / 60_000),
    }));
  }

  /**
   * Applique le nouveau mot de passe depuis un lien valide, révoque toutes les sessions
   * et renvoie un jeu de jetons : l'utilisateur est connecté sans ressaisir son mot de passe.
   */
  async reinitialiser(token: string, nouveauMotDePasse: string): Promise<ResultatAuthentification> {
    const demande = await this.depotDemandes.trouverParTokenHash(hacherToken(token));
    if (!demande || demande.dateUtilisation !== null || demande.dateExpiration < new Date()) {
      throw new ErreurAuthentification('Ce lien est invalide ou a expiré. Refaites une demande.', 'LIEN_INVALIDE');
    }

    const validation = validerForceMotDePasse(nouveauMotDePasse);
    if (!validation.valide) {
      throw new ErreurAuthentification(validation.erreurs.join('. '), 'MOT_DE_PASSE_FAIBLE');
    }

    const utilisateur = await this.depotUtilisateurs.trouverParId(demande.utilisateurId);
    if (!utilisateur || !utilisateur.estActif) {
      throw new ErreurAuthentification('Ce compte a été désactivé', 'COMPTE_INACTIF');
    }

    const motDePasseHash = await hasherMotDePasse(nouveauMotDePasse);
    await this.depotUtilisateurs.mettreAJour(utilisateur.id, { motDePasseHash });
    await this.depotDemandes.marquerUtilisee(demande.id);
    await this.depotRefreshTokens.revoquerTousTokensUtilisateur(utilisateur.id);
    await reinitialiserTentatives(utilisateur.email);

    return this.emetteur.emettreTokens({ ...utilisateur, motDePasseHash });
  }
}
