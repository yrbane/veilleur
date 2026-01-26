/**
 * Veilleur - Implémentation du dépôt utilisateurs avec MariaDB
 */

import { eq, and, lt } from 'drizzle-orm';
import type { DepotUtilisateurs, DepotRefreshTokens } from '@/domaine/ports/DepotUtilisateurs';
import type { Utilisateur, Preferences } from '@/domaine/entites/Utilisateur';
import { obtenirBdd } from './connexion';
import { utilisateurs, refreshTokens } from './schema';
import { loggerBdd } from '../logging/logger';
import { createId } from '@paralleldrive/cuid2';

/**
 * Implémentation du dépôt utilisateurs avec Drizzle ORM
 */
export class DepotUtilisateursMariaDB implements DepotUtilisateurs {
  async trouverParId(id: string): Promise<Utilisateur | null> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select()
        .from(utilisateurs)
        .where(eq(utilisateurs.id, id))
        .limit(1);

      const result = resultats[0];
      if (!result) {
        return null;
      }

      return this.versUtilisateur(result);
    } catch (erreur) {
      loggerBdd.error({ erreur, id }, 'Erreur lors de la recherche utilisateur par ID');
      throw erreur;
    }
  }

  async trouverParEmail(email: string): Promise<Utilisateur | null> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select()
        .from(utilisateurs)
        .where(eq(utilisateurs.email, email.toLowerCase()))
        .limit(1);

      const result = resultats[0];
      if (!result) {
        return null;
      }

      return this.versUtilisateur(result);
    } catch (erreur) {
      loggerBdd.error({ erreur, email }, 'Erreur lors de la recherche utilisateur par email');
      throw erreur;
    }
  }

  async creer(
    donnees: Omit<Utilisateur, 'id' | 'dateCreation'>,
  ): Promise<Utilisateur> {
    const db = obtenirBdd();
    const id = createId();
    const dateCreation = new Date();

    try {
      await db.insert(utilisateurs).values({
        id,
        email: donnees.email.toLowerCase(),
        motDePasseHash: donnees.motDePasseHash,
        dateCreation,
        dateDerniereConnexion: donnees.dateDerniereConnexion,
        preferences: donnees.preferences ?? {},
        estActif: donnees.estActif ?? true,
      });

      loggerBdd.info({ id, email: donnees.email }, 'Utilisateur créé');

      return {
        id,
        ...donnees,
        email: donnees.email.toLowerCase(),
        dateCreation,
      };
    } catch (erreur) {
      loggerBdd.error({ erreur, email: donnees.email }, 'Erreur lors de la création utilisateur');
      throw erreur;
    }
  }

  async mettreAJour(
    id: string,
    donnees: Partial<Utilisateur>,
  ): Promise<Utilisateur | null> {
    const db = obtenirBdd();

    try {
      const updateData: Record<string, unknown> = {};

      if (donnees.email !== undefined) {
        updateData.email = donnees.email.toLowerCase();
      }
      if (donnees.motDePasseHash !== undefined) {
        updateData.motDePasseHash = donnees.motDePasseHash;
      }
      if (donnees.preferences !== undefined) {
        updateData.preferences = donnees.preferences;
      }
      if (donnees.estActif !== undefined) {
        updateData.estActif = donnees.estActif;
      }
      if (donnees.dateDerniereConnexion !== undefined) {
        updateData.dateDerniereConnexion = donnees.dateDerniereConnexion;
      }
      if (donnees.totpSecret !== undefined) {
        updateData.totpSecret = donnees.totpSecret;
      }
      if (donnees.totpActif !== undefined) {
        updateData.totpActif = donnees.totpActif;
      }

      if (Object.keys(updateData).length === 0) {
        return this.trouverParId(id);
      }

      await db
        .update(utilisateurs)
        .set(updateData)
        .where(eq(utilisateurs.id, id));

      loggerBdd.info({ id }, 'Utilisateur mis à jour');

      return this.trouverParId(id);
    } catch (erreur) {
      loggerBdd.error({ erreur, id }, 'Erreur lors de la mise à jour utilisateur');
      throw erreur;
    }
  }

  async emailExiste(email: string): Promise<boolean> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select({ id: utilisateurs.id })
        .from(utilisateurs)
        .where(eq(utilisateurs.email, email.toLowerCase()))
        .limit(1);

      return resultats.length > 0;
    } catch (erreur) {
      loggerBdd.error({ erreur, email }, 'Erreur lors de la vérification email');
      throw erreur;
    }
  }

  async mettreAJourDerniereConnexion(id: string): Promise<void> {
    const db = obtenirBdd();

    try {
      await db
        .update(utilisateurs)
        .set({ dateDerniereConnexion: new Date() })
        .where(eq(utilisateurs.id, id));

      loggerBdd.debug({ id }, 'Dernière connexion mise à jour');
    } catch (erreur) {
      loggerBdd.error({ erreur, id }, 'Erreur lors de la mise à jour dernière connexion');
      throw erreur;
    }
  }

  async desactiver(id: string): Promise<boolean> {
    const db = obtenirBdd();

    try {
      const resultat = await db
        .update(utilisateurs)
        .set({ estActif: false })
        .where(eq(utilisateurs.id, id));

      const affecte = (resultat as unknown as { affectedRows: number }).affectedRows > 0;

      if (affecte) {
        loggerBdd.info({ id }, 'Utilisateur désactivé');
      }

      return affecte;
    } catch (erreur) {
      loggerBdd.error({ erreur, id }, 'Erreur lors de la désactivation utilisateur');
      throw erreur;
    }
  }

  private versUtilisateur(row: typeof utilisateurs.$inferSelect): Utilisateur {
    return {
      id: row.id,
      email: row.email,
      motDePasseHash: row.motDePasseHash,
      dateCreation: row.dateCreation,
      dateDerniereConnexion: row.dateDerniereConnexion,
      preferences: (row.preferences as Preferences) ?? {
        langue: 'fr',
        theme: 'auto',
        frequenceRafraichissement: 30,
      },
      estActif: row.estActif ?? true,
      totpSecret: row.totpSecret ?? null,
      totpActif: row.totpActif ?? false,
    };
  }
}

/**
 * Implémentation du dépôt refresh tokens avec Drizzle ORM
 */
export class DepotRefreshTokensMariaDB implements DepotRefreshTokens {
  async creer(
    utilisateurId: string,
    token: string,
    dateExpiration: Date,
  ): Promise<void> {
    const db = obtenirBdd();

    try {
      await db.insert(refreshTokens).values({
        id: createId(),
        utilisateurId,
        token,
        dateExpiration,
        dateCreation: new Date(),
        estRevoque: false,
      });

      loggerBdd.debug({ utilisateurId }, 'Refresh token créé');
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId }, 'Erreur lors de la création du refresh token');
      throw erreur;
    }
  }

  async trouverTokenValide(token: string): Promise<{ utilisateurId: string } | null> {
    const db = obtenirBdd();
    const maintenant = new Date();

    try {
      const resultats = await db
        .select({ utilisateurId: refreshTokens.utilisateurId })
        .from(refreshTokens)
        .where(
          and(
            eq(refreshTokens.token, token),
            eq(refreshTokens.estRevoque, false),
          ),
        )
        .limit(1);

      const result = resultats[0];
      if (!result) {
        return null;
      }

      // Vérifier l'expiration en mémoire
      const tokenData = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.token, token))
        .limit(1);

      const tokenInfo = tokenData[0];
      if (!tokenInfo || tokenInfo.dateExpiration < maintenant) {
        return null;
      }

      return { utilisateurId: result.utilisateurId };
    } catch (erreur) {
      loggerBdd.error({ erreur }, 'Erreur lors de la recherche du refresh token');
      throw erreur;
    }
  }

  async revoquer(token: string): Promise<boolean> {
    const db = obtenirBdd();

    try {
      const resultat = await db
        .update(refreshTokens)
        .set({ estRevoque: true })
        .where(eq(refreshTokens.token, token));

      const affecte = (resultat as unknown as { affectedRows: number }).affectedRows > 0;

      if (affecte) {
        loggerBdd.debug('Refresh token révoqué');
      }

      return affecte;
    } catch (erreur) {
      loggerBdd.error({ erreur }, 'Erreur lors de la révocation du refresh token');
      throw erreur;
    }
  }

  async revoquerTousTokensUtilisateur(utilisateurId: string): Promise<number> {
    const db = obtenirBdd();

    try {
      const resultat = await db
        .update(refreshTokens)
        .set({ estRevoque: true })
        .where(
          and(
            eq(refreshTokens.utilisateurId, utilisateurId),
            eq(refreshTokens.estRevoque, false),
          ),
        );

      const affectes = (resultat as unknown as { affectedRows: number }).affectedRows;

      loggerBdd.info({ utilisateurId, tokensRevoques: affectes }, 'Tous les refresh tokens révoqués');

      return affectes;
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId }, 'Erreur lors de la révocation des refresh tokens');
      throw erreur;
    }
  }

  async nettoyerTokensExpires(): Promise<number> {
    const db = obtenirBdd();
    const maintenant = new Date();

    try {
      const resultat = await db
        .delete(refreshTokens)
        .where(lt(refreshTokens.dateExpiration, maintenant));

      const supprimes = (resultat as unknown as { affectedRows: number }).affectedRows;

      if (supprimes > 0) {
        loggerBdd.info({ tokensSupprimes: supprimes }, 'Tokens expirés nettoyés');
      }

      return supprimes;
    } catch (erreur) {
      loggerBdd.error({ erreur }, 'Erreur lors du nettoyage des tokens expirés');
      throw erreur;
    }
  }
}
