/**
 * Veilleur - Statistiques d'activité d'un utilisateur (MariaDB)
 */

import { and, eq, sql } from 'drizzle-orm';
import type {
  DepotStatistiquesUtilisateur,
  ParticipantClassement,
  StatistiquesUtilisateur,
} from '@/domaine/ports/DepotStatistiquesUtilisateur';
import { obtenirBdd } from './connexion';
import { utilisateurs, utilisateursArticles, utilisateursSources, utilisateursSourcesTags } from './schema';
import { loggerBdd } from '../logging/logger';

const PARTICIPANTS_MAX = 200;
const JOURS_LECTURE_MAX = 400;

export class DepotStatistiquesUtilisateurMariaDB implements DepotStatistiquesUtilisateur {
  async obtenir(utilisateurId: string): Promise<StatistiquesUtilisateur | null> {
    const db = obtenirBdd();
    try {
      const [compte] = await db
        .select({ dateInscription: utilisateurs.dateCreation })
        .from(utilisateurs)
        .where(eq(utilisateurs.id, utilisateurId))
        .limit(1);
      if (!compte) return null;

      const [annotations] = await db
        .select({
          articlesLus: sql<number>`SUM(${utilisateursArticles.luLe} IS NOT NULL)`,
          articlesNotes: sql<number>`SUM(${utilisateursArticles.note} IS NOT NULL)`,
          favoris: sql<number>`SUM(${utilisateursArticles.favori} = true)`,
          aLire: sql<number>`SUM(${utilisateursArticles.aLire} = true)`,
          lecturesAvant8h: sql<number>`SUM(${utilisateursArticles.luLe} IS NOT NULL AND HOUR(${utilisateursArticles.luLe}) < 8)`,
        })
        .from(utilisateursArticles)
        .where(eq(utilisateursArticles.utilisateurId, utilisateurId));

      const [sourcesCompte] = await db
        .select({ sources: sql<number>`COUNT(*)` })
        .from(utilisateursSources)
        .where(eq(utilisateursSources.utilisateurId, utilisateurId));

      const [rubriquesCompte] = await db
        .select({ rubriques: sql<number>`COUNT(DISTINCT ${utilisateursSourcesTags.tagId})` })
        .from(utilisateursSourcesTags)
        .innerJoin(utilisateursSources, eq(utilisateursSources.id, utilisateursSourcesTags.utilisateurSourceId))
        .where(eq(utilisateursSources.utilisateurId, utilisateurId));

      const jours = await db
        .select({ jour: sql<string>`DATE_FORMAT(${utilisateursArticles.luLe}, '%Y-%m-%d')`, nombre: sql<number>`COUNT(*)` })
        .from(utilisateursArticles)
        .where(and(eq(utilisateursArticles.utilisateurId, utilisateurId), sql`${utilisateursArticles.luLe} IS NOT NULL`))
        .groupBy(sql`DATE_FORMAT(${utilisateursArticles.luLe}, '%Y-%m-%d')`)
        .orderBy(sql`DATE_FORMAT(${utilisateursArticles.luLe}, '%Y-%m-%d') DESC`)
        .limit(JOURS_LECTURE_MAX);

      return {
        utilisateurId,
        articlesLus: Number(annotations?.articlesLus ?? 0),
        articlesNotes: Number(annotations?.articlesNotes ?? 0),
        favoris: Number(annotations?.favoris ?? 0),
        aLire: Number(annotations?.aLire ?? 0),
        sources: Number(sourcesCompte?.sources ?? 0),
        rubriques: Number(rubriquesCompte?.rubriques ?? 0),
        joursLecture: jours.map(j => j.jour),
        lecturesAvant8h: Number(annotations?.lecturesAvant8h ?? 0),
        maxLecturesParJour: jours.reduce((max, j) => Math.max(max, Number(j.nombre)), 0),
        dateInscription: compte.dateInscription,
      };
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId }, 'Erreur lors du calcul des statistiques utilisateur');
      throw erreur;
    }
  }

  async listerParticipantsClassement(limite = PARTICIPANTS_MAX): Promise<ParticipantClassement[]> {
    const db = obtenirBdd();
    try {
      const volontaires = await db
        .select({ id: utilisateurs.id, pseudo: sql<string | null>`JSON_UNQUOTE(JSON_EXTRACT(${utilisateurs.preferences}, '$.pseudo'))` })
        .from(utilisateurs)
        .where(
          and(
            eq(utilisateurs.estActif, true),
            sql`JSON_EXTRACT(${utilisateurs.preferences}, '$.classementPublic') = true`,
          ),
        )
        .limit(limite);
      const participants: ParticipantClassement[] = [];
      for (const volontaire of volontaires) {
        const statistiques = await this.obtenir(volontaire.id);
        if (!statistiques) continue;
        const pseudo = volontaire.pseudo && volontaire.pseudo !== 'null' ? volontaire.pseudo : `Veilleur ${volontaire.id.slice(0, 4)}`;
        participants.push({ utilisateurId: volontaire.id, pseudo, statistiques });
      }
      return participants;
    } catch (erreur) {
      loggerBdd.error({ erreur }, 'Erreur lors de la liste des participants au classement');
      throw erreur;
    }
  }
}
