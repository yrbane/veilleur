/**
 * Veilleur - Abonnements Web Push et destinataires (MariaDB)
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type {
  DepotNotifications,
  AbonnementPush,
  AbonnementPushUtilisateur,
  AbonneSource,
  DestinataireResume,
  FrequenceResume,
} from '@/domaine/ports/DepotNotifications';
import { obtenirBdd } from './connexion';
import { abonnementsPush, parametresSources, sources, utilisateurs, utilisateursSources } from './schema';
import { loggerBdd } from '../logging/logger';

export class DepotNotificationsMariaDB implements DepotNotifications {
  async enregistrerAbonnementPush(utilisateurId: string, abonnement: AbonnementPush, userAgent: string | null = null): Promise<void> {
    const db = obtenirBdd();
    try {
      await db
        .insert(abonnementsPush)
        .values({
          id: createId(),
          utilisateurId,
          endpoint: abonnement.endpoint,
          clePublique: abonnement.clePublique,
          secretAuth: abonnement.secretAuth,
          userAgent: userAgent?.slice(0, 255) ?? null,
        })
        .onDuplicateKeyUpdate({
          set: { utilisateurId, clePublique: abonnement.clePublique, secretAuth: abonnement.secretAuth, userAgent: userAgent?.slice(0, 255) ?? null },
        });
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId }, 'Erreur lors de l\'enregistrement d\'un abonnement push');
      throw erreur;
    }
  }

  async supprimerAbonnementPush(utilisateurId: string, endpoint: string): Promise<boolean> {
    const db = obtenirBdd();
    const [resultat] = await db
      .delete(abonnementsPush)
      .where(and(eq(abonnementsPush.utilisateurId, utilisateurId), eq(abonnementsPush.endpoint, endpoint)));
    return resultat.affectedRows > 0;
  }

  async supprimerAbonnementParEndpoint(endpoint: string): Promise<void> {
    const db = obtenirBdd();
    await db.delete(abonnementsPush).where(eq(abonnementsPush.endpoint, endpoint));
  }

  async listerAbonnementsPush(utilisateurIds: string[]): Promise<AbonnementPushUtilisateur[]> {
    if (utilisateurIds.length === 0) return [];
    const db = obtenirBdd();
    const lignes = await db
      .select({
        utilisateurId: abonnementsPush.utilisateurId,
        endpoint: abonnementsPush.endpoint,
        clePublique: abonnementsPush.clePublique,
        secretAuth: abonnementsPush.secretAuth,
      })
      .from(abonnementsPush)
      .where(inArray(abonnementsPush.utilisateurId, utilisateurIds));
    return lignes.map(l => ({
      utilisateurId: l.utilisateurId,
      abonnement: { endpoint: l.endpoint, clePublique: l.clePublique, secretAuth: l.secretAuth },
    }));
  }

  async compterAbonnementsPush(utilisateurId: string): Promise<number> {
    const db = obtenirBdd();
    const [ligne] = await db
      .select({ nombre: sql<number>`COUNT(*)` })
      .from(abonnementsPush)
      .where(eq(abonnementsPush.utilisateurId, utilisateurId));
    return Number(ligne?.nombre ?? 0);
  }

  /**
   * Abonnés d'une source dont les paramètres n'ont pas coupé les notifications (absence = « nouveaux »)
   */
  async listerAbonnesSources(sourceIds: string[]): Promise<AbonneSource[]> {
    if (sourceIds.length === 0) return [];
    const db = obtenirBdd();
    try {
      const lignes = await db
        .select({ utilisateurId: utilisateursSources.utilisateurId, sourceId: utilisateursSources.sourceId, nomSource: sources.nom })
        .from(utilisateursSources)
        .innerJoin(sources, eq(sources.id, utilisateursSources.sourceId))
        .leftJoin(parametresSources, eq(parametresSources.utilisateurSourceId, utilisateursSources.id))
        .where(
          and(
            inArray(utilisateursSources.sourceId, sourceIds),
            sql`(${parametresSources.notifications} IS NULL OR ${parametresSources.notifications} <> 'aucune')`,
          ),
        );
      return lignes;
    } catch (erreur) {
      loggerBdd.error({ erreur }, 'Erreur lors de la liste des abonnés à notifier');
      throw erreur;
    }
  }

  async listerDestinatairesResume(frequence: FrequenceResume): Promise<DestinataireResume[]> {
    const db = obtenirBdd();
    return db
      .select({ utilisateurId: utilisateurs.id, email: utilisateurs.email })
      .from(utilisateurs)
      .where(
        and(
          eq(utilisateurs.estActif, true),
          sql`JSON_UNQUOTE(JSON_EXTRACT(${utilisateurs.preferences}, '$.resumeCourriel')) = ${frequence}`,
        ),
      );
  }
}
