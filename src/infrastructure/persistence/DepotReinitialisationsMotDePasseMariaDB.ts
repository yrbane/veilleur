/**
 * Veilleur - Dépôt MariaDB des demandes de réinitialisation de mot de passe
 */

import { and, eq, isNull } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type {
  DemandeReinitialisation,
  DepotReinitialisationsMotDePasse,
} from '@/domaine/ports/DepotReinitialisationsMotDePasse';
import { obtenirBdd } from './connexion';
import { reinitialisationsMotDePasse } from './schema';
import { loggerBdd } from '../logging/logger';

type Resultat = { affectedRows: number };

export class DepotReinitialisationsMotDePasseMariaDB implements DepotReinitialisationsMotDePasse {
  async creer(demande: Omit<DemandeReinitialisation, 'id' | 'dateUtilisation'>): Promise<void> {
    const db = obtenirBdd();
    try {
      await db.insert(reinitialisationsMotDePasse).values({
        id: createId(),
        utilisateurId: demande.utilisateurId,
        tokenHash: demande.tokenHash,
        dateCreation: new Date(),
        dateExpiration: demande.dateExpiration,
      });
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId: demande.utilisateurId }, 'Erreur lors de la création de la demande de réinitialisation');
      throw erreur;
    }
  }

  async trouverParTokenHash(tokenHash: string): Promise<DemandeReinitialisation | null> {
    const db = obtenirBdd();
    try {
      const lignes = await db
        .select()
        .from(reinitialisationsMotDePasse)
        .where(eq(reinitialisationsMotDePasse.tokenHash, tokenHash))
        .limit(1);
      const ligne = lignes[0];
      if (!ligne) return null;
      return {
        id: ligne.id,
        utilisateurId: ligne.utilisateurId,
        tokenHash: ligne.tokenHash,
        dateExpiration: ligne.dateExpiration,
        dateUtilisation: ligne.dateUtilisation ?? null,
      };
    } catch (erreur) {
      loggerBdd.error({ erreur }, 'Erreur lors de la recherche de la demande de réinitialisation');
      throw erreur;
    }
  }

  async marquerUtilisee(id: string): Promise<boolean> {
    const db = obtenirBdd();
    try {
      const resultat = await db
        .update(reinitialisationsMotDePasse)
        .set({ dateUtilisation: new Date() })
        .where(and(eq(reinitialisationsMotDePasse.id, id), isNull(reinitialisationsMotDePasse.dateUtilisation)));
      return (resultat as unknown as Resultat).affectedRows > 0;
    } catch (erreur) {
      loggerBdd.error({ erreur, id }, 'Erreur lors de la consommation de la demande de réinitialisation');
      throw erreur;
    }
  }

  async invaliderPourUtilisateur(utilisateurId: string): Promise<number> {
    const db = obtenirBdd();
    try {
      const resultat = await db
        .update(reinitialisationsMotDePasse)
        .set({ dateUtilisation: new Date() })
        .where(and(
          eq(reinitialisationsMotDePasse.utilisateurId, utilisateurId),
          isNull(reinitialisationsMotDePasse.dateUtilisation),
        ));
      return (resultat as unknown as Resultat).affectedRows;
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId }, 'Erreur lors de l\'invalidation des demandes de réinitialisation');
      throw erreur;
    }
  }
}
