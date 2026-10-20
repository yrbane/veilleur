/**
 * Veilleur - Port : statistiques d'activité d'un utilisateur (base de la gamification)
 */

export interface StatistiquesUtilisateur {
  utilisateurId: string;
  articlesLus: number;
  articlesNotes: number;
  favoris: number;
  aLire: number;
  sources: number;
  rubriques: number;
  /** Jours (AAAA-MM-JJ) comportant au moins une lecture, ordre indifférent */
  joursLecture: string[];
  /** Lectures effectuées avant 8 h (heure du serveur) */
  lecturesAvant8h: number;
  /** Plus grand nombre de lectures sur une même journée */
  maxLecturesParJour: number;
  dateInscription: Date;
}

export interface ParticipantClassement {
  utilisateurId: string;
  pseudo: string;
  statistiques: StatistiquesUtilisateur;
}

export interface DepotStatistiquesUtilisateur {
  obtenir(utilisateurId: string): Promise<StatistiquesUtilisateur | null>;
  /** Utilisateurs ayant choisi d'apparaître au classement (préférence classementPublic), avec leur pseudo */
  listerParticipantsClassement(limite?: number): Promise<ParticipantClassement[]>;
}
