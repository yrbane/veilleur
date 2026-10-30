/**
 * Veilleur - Dépôt d'administration MariaDB : agrégats anonymes pour le tableau de bord,
 * listes paginées des comptes et des sources, suppression complète d'un compte
 */

import { sql } from 'drizzle-orm';
import type {
  ChangementsUtilisateur,
  CompteursAnnotations,
  CompteursArticles,
  CompteursImages,
  CompteursSources,
  CompteursUtilisateurs,
  DepotAdministration,
  OptionsListe,
  PointSerie,
  ResultatListe,
  SourceAdmin,
  UtilisateurAdmin,
} from '@/domaine/services/ServiceAdministration';
import { TRIS_SOURCES, TRIS_UTILISATEURS, resoudreTri } from '@/domaine/services/ServiceAdministration';
import type { RoleUtilisateur } from '@/domaine/entites/Utilisateur';
import { obtenirBdd } from './connexion';
import { loggerBdd } from '../logging/logger';

type Ligne = Record<string, unknown>;

/** Les COUNT/SUM reviennent parfois en chaîne : on les ramène à un nombre */
const n = (valeur: unknown): number => Number(valeur ?? 0) || 0;

export class DepotAdministrationMariaDB implements DepotAdministration {
  private async lignes(requete: ReturnType<typeof sql>): Promise<Ligne[]> {
    try {
      const [resultat] = await obtenirBdd().execute(requete);
      return resultat as unknown as Ligne[];
    } catch (erreur) {
      loggerBdd.error({ erreur }, 'Erreur requête d\'administration');
      throw erreur;
    }
  }

  private async premiere(requete: ReturnType<typeof sql>): Promise<Ligne> {
    return (await this.lignes(requete))[0] ?? {};
  }

  async compterUtilisateurs(): Promise<CompteursUtilisateurs> {
    const l = await this.premiere(sql`SELECT COUNT(*) AS total,
        SUM(est_actif = 1) AS actifs,
        SUM(role = 'admin') AS admins,
        SUM(totp_actif = 1) AS avec2fa,
        SUM(date_creation >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS nouveaux7j,
        SUM(date_derniere_connexion >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS connectes7j,
        (SELECT COUNT(DISTINCT utilisateur_id) FROM abonnements_push) AS abonnesPush
      FROM utilisateurs`);
    return {
      total: n(l.total), actifs: n(l.actifs), admins: n(l.admins), avec2fa: n(l.avec2fa),
      nouveaux7j: n(l.nouveaux7j), connectes7j: n(l.connectes7j), abonnesPush: n(l.abonnesPush),
    };
  }

  async compterSources(): Promise<CompteursSources> {
    const [global, types, statuts] = await Promise.all([
      this.premiere(sql`SELECT COUNT(*) AS total, SUM(nombre_echecs > 0) AS enEchec,
          (SELECT COUNT(*) FROM utilisateurs_sources) AS abonnements,
          (SELECT COUNT(*) FROM utilisateurs_sources WHERE est_en_pause = 1) AS enPause
        FROM sources`),
      this.lignes(sql`SELECT type_source AS cle, COUNT(*) AS nombre FROM sources GROUP BY type_source`),
      this.lignes(sql`SELECT statut AS cle, COUNT(*) AS nombre FROM sources GROUP BY statut`),
    ]);
    const repartition = (lignes: Ligne[]): Record<string, number> => Object.fromEntries(lignes.map(l => [String(l.cle), n(l.nombre)]));
    return { total: n(global.total), enEchec: n(global.enEchec), abonnements: n(global.abonnements), enPause: n(global.enPause), parType: repartition(types), parStatut: repartition(statuts) };
  }

  async compterArticles(): Promise<CompteursArticles> {
    const l = await this.premiere(sql`SELECT COUNT(*) AS total,
        SUM(date_publication >= DATE_SUB(NOW(), INTERVAL 1 DAY)) AS dernieres24h,
        SUM(date_publication >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS derniers7j,
        SUM(url_image IS NOT NULL AND url_image <> '') AS avecImage,
        (SELECT COUNT(*) FROM images_cachees WHERE statut = 'termine') AS imagesCachees
      FROM articles`);
    return { total: n(l.total), dernieres24h: n(l.dernieres24h), derniers7j: n(l.derniers7j), avecImage: n(l.avecImage), imagesCachees: n(l.imagesCachees) };
  }

  async compterAnnotations(): Promise<CompteursAnnotations> {
    const [l, notes] = await Promise.all([
      this.premiere(sql`SELECT SUM(lu_le IS NOT NULL) AS lus, SUM(note IS NOT NULL) AS notes, SUM(favori = 1) AS favoris,
          SUM(a_lire = 1) AS aLire, AVG(note) AS noteMoyenne FROM utilisateurs_articles`),
      this.lignes(sql`SELECT note, COUNT(*) AS nombre FROM utilisateurs_articles WHERE note IS NOT NULL GROUP BY note`),
    ]);
    const repartitionNotes = [0, 0, 0, 0, 0];
    for (const ligne of notes) {
      const note = n(ligne.note);
      if (note >= 1 && note <= 5) repartitionNotes[note - 1] = n(ligne.nombre);
    }
    return { lus: n(l.lus), notes: n(l.notes), favoris: n(l.favoris), aLire: n(l.aLire), noteMoyenne: l.noteMoyenne === null || l.noteMoyenne === undefined ? null : Math.round(Number(l.noteMoyenne) * 100) / 100, repartitionNotes };
  }

  async compterImages(): Promise<CompteursImages> {
    const lignes = await this.lignes(sql`SELECT statut, COUNT(*) AS nombre, COALESCE(SUM(taille_fichier), 0) AS octets FROM images_cachees GROUP BY statut`);
    const parStatut: Record<string, number> = {};
    let octets = 0;
    for (const l of lignes) {
      parStatut[String(l.statut)] = n(l.nombre);
      octets += n(l.octets);
    }
    return { parStatut, octets };
  }

  private async serie(table: string, colonne: string, jours: number): Promise<PointSerie[]> {
    const lignes = await this.lignes(sql`SELECT DATE_FORMAT(${sql.raw(colonne)}, '%Y-%m-%d') AS jour, COUNT(*) AS valeur
      FROM ${sql.raw(table)} WHERE ${sql.raw(colonne)} >= DATE_SUB(CURDATE(), INTERVAL ${jours - 1} DAY)
      GROUP BY jour ORDER BY jour`);
    return lignes.map(l => ({ jour: String(l.jour), valeur: n(l.valeur) }));
  }

  serieInscriptions(jours: number): Promise<PointSerie[]> {
    return this.serie('utilisateurs', 'date_creation', jours);
  }

  serieArticles(jours: number): Promise<PointSerie[]> {
    return this.serie('articles', 'date_extraction', jours);
  }

  serieLectures(jours: number): Promise<PointSerie[]> {
    return this.serie('utilisateurs_articles', 'lu_le', jours);
  }

  async articlesParHeure(jours: number): Promise<Array<{ heure: number; nombre: number }>> {
    const lignes = await this.lignes(sql`SELECT HOUR(date_publication) AS heure, COUNT(*) AS nombre FROM articles
      WHERE date_publication >= DATE_SUB(NOW(), INTERVAL ${jours} DAY) GROUP BY heure`);
    return lignes.map(l => ({ heure: n(l.heure), nombre: n(l.nombre) }));
  }

  private readonly selectionSource = sql`SELECT s.id, s.nom, s.url, s.type_source AS typeSource, s.statut, s.url_favicon AS urlFavicon,
      s.nombre_echecs AS nombreEchecs, s.date_derniere_synchro AS dateDerniereSynchro,
      (SELECT COUNT(*) FROM utilisateurs_sources us WHERE us.source_id = s.id) AS abonnes,
      (SELECT COUNT(*) FROM articles a WHERE a.source_id = s.id) AS articles
    FROM sources s`;

  private versSource(l: Ligne): SourceAdmin {
    return {
      id: String(l.id), nom: String(l.nom), url: String(l.url), typeSource: String(l.typeSource), statut: String(l.statut),
      urlFavicon: l.urlFavicon === null || l.urlFavicon === undefined ? null : String(l.urlFavicon), nombreEchecs: n(l.nombreEchecs),
      dateDerniereSynchro: l.dateDerniereSynchro ? new Date(l.dateDerniereSynchro as string) : null,
      abonnes: n(l.abonnes), articles: n(l.articles),
    };
  }

  async listerTopSources(limite: number): Promise<SourceAdmin[]> {
    const lignes = await this.lignes(sql`${this.selectionSource} ORDER BY abonnes DESC, articles DESC LIMIT ${limite}`);
    return lignes.map(l => this.versSource(l));
  }

  async listerSources(options: OptionsListe): Promise<ResultatListe<SourceAdmin>> {
    const motif = `%${options.recherche ?? ''}%`;
    const filtre = options.recherche ? sql`WHERE s.nom LIKE ${motif} OR s.url LIKE ${motif}` : sql``;
    const tri = resoudreTri(TRIS_SOURCES, options.tri, options.ordre);
    const [lignes, total] = await Promise.all([
      this.lignes(sql`${this.selectionSource} ${filtre} ORDER BY ${sql.raw(tri.expression)} ${sql.raw(tri.ordre.toUpperCase())}, s.nom ASC LIMIT ${options.limite} OFFSET ${(options.page - 1) * options.limite}`),
      this.premiere(sql`SELECT COUNT(*) AS total FROM sources s ${filtre}`),
    ]);
    return { donnees: lignes.map(l => this.versSource(l)), total: n(total.total) };
  }

  async listerTagsPopulaires(limite: number): Promise<Array<{ nom: string; slug: string; nombreSources: number }>> {
    const lignes = await this.lignes(sql`SELECT t.nom, t.slug, COUNT(ust.id) AS nombreSources FROM tags t
      LEFT JOIN utilisateurs_sources_tags ust ON ust.tag_id = t.id GROUP BY t.id ORDER BY nombreSources DESC, t.nom ASC LIMIT ${limite}`);
    return lignes.map(l => ({ nom: String(l.nom), slug: String(l.slug), nombreSources: n(l.nombreSources) }));
  }

  async listerMotsClesFrequents(limite: number): Promise<Array<{ mot: string; nombre: number }>> {
    const lignes = await this.lignes(sql`SELECT mot, COUNT(*) AS nombre FROM articles_mots_cles GROUP BY mot ORDER BY nombre DESC LIMIT ${limite}`);
    return lignes.map(l => ({ mot: String(l.mot), nombre: n(l.nombre) }));
  }

  private readonly selectionUtilisateur = sql`SELECT u.id, u.email, u.role, u.est_actif AS estActif, u.totp_actif AS totpActif,
      u.date_creation AS dateCreation, u.date_derniere_connexion AS dateDerniereConnexion,
      (SELECT COUNT(*) FROM utilisateurs_sources us WHERE us.utilisateur_id = u.id) AS nombreSources,
      (SELECT COUNT(*) FROM utilisateurs_articles ua WHERE ua.utilisateur_id = u.id AND ua.lu_le IS NOT NULL) AS nombreLectures
    FROM utilisateurs u`;

  private versUtilisateur(l: Ligne): UtilisateurAdmin {
    return {
      id: String(l.id), email: String(l.email), role: (l.role as RoleUtilisateur) ?? 'membre',
      estActif: n(l.estActif) === 1, totpActif: n(l.totpActif) === 1,
      dateCreation: new Date(l.dateCreation as string),
      dateDerniereConnexion: l.dateDerniereConnexion ? new Date(l.dateDerniereConnexion as string) : null,
      nombreSources: n(l.nombreSources), nombreLectures: n(l.nombreLectures),
    };
  }

  async listerUtilisateurs(options: OptionsListe): Promise<ResultatListe<UtilisateurAdmin>> {
    const motif = `%${options.recherche ?? ''}%`;
    const filtre = options.recherche ? sql`WHERE u.email LIKE ${motif}` : sql``;
    const tri = resoudreTri(TRIS_UTILISATEURS, options.tri, options.ordre);
    const [lignes, total] = await Promise.all([
      this.lignes(sql`${this.selectionUtilisateur} ${filtre} ORDER BY ${sql.raw(tri.expression)} ${sql.raw(tri.ordre.toUpperCase())}, u.email ASC LIMIT ${options.limite} OFFSET ${(options.page - 1) * options.limite}`),
      this.premiere(sql`SELECT COUNT(*) AS total FROM utilisateurs u ${filtre}`),
    ]);
    return { donnees: lignes.map(l => this.versUtilisateur(l)), total: n(total.total) };
  }

  async trouverUtilisateur(id: string): Promise<UtilisateurAdmin | null> {
    const l = await this.premiere(sql`${this.selectionUtilisateur} WHERE u.id = ${id}`);
    return l.id ? this.versUtilisateur(l) : null;
  }

  async mettreAJourUtilisateur(id: string, changements: ChangementsUtilisateur): Promise<void> {
    if (changements.role !== undefined) {
      await this.lignes(sql`UPDATE utilisateurs SET role = ${changements.role} WHERE id = ${id}`);
    }
    if (changements.estActif !== undefined) {
      await this.lignes(sql`UPDATE utilisateurs SET est_actif = ${changements.estActif ? 1 : 0} WHERE id = ${id}`);
      if (!changements.estActif) {
        // Un compte désactivé perd ses sessions ouvertes
        await this.lignes(sql`UPDATE refresh_tokens SET est_revoque = 1 WHERE utilisateur_id = ${id}`);
      }
    }
  }

  /**
   * Supprime un compte et tout ce qui lui appartient, des tables filles vers la table mère
   * (toutes les clés étrangères ne cascadent pas)
   */
  async supprimerUtilisateur(id: string): Promise<void> {
    await this.lignes(sql`DELETE ust FROM utilisateurs_sources_tags ust
      INNER JOIN utilisateurs_sources us ON us.id = ust.utilisateur_source_id WHERE us.utilisateur_id = ${id}`);
    await this.lignes(sql`DELETE ps FROM parametres_sources ps
      INNER JOIN utilisateurs_sources us ON us.id = ps.utilisateur_source_id WHERE us.utilisateur_id = ${id}`);
    await this.lignes(sql`DELETE FROM utilisateurs_articles WHERE utilisateur_id = ${id}`);
    await this.lignes(sql`DELETE FROM utilisateurs_sources WHERE utilisateur_id = ${id}`);
    await this.lignes(sql`DELETE FROM abonnements_push WHERE utilisateur_id = ${id}`);
    await this.lignes(sql`DELETE FROM refresh_tokens WHERE utilisateur_id = ${id}`);
    await this.lignes(sql`DELETE FROM utilisateurs WHERE id = ${id}`);
    // Les tags que plus personne n'utilise disparaissent avec le compte
    await this.lignes(sql`DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM utilisateurs_sources_tags)`);
  }

  /** Taille de la base courante en octets (données + index) */
  async tailleBaseDonnees(): Promise<number> {
    const l = await this.premiere(sql`SELECT COALESCE(SUM(data_length + index_length), 0) AS octets
      FROM information_schema.tables WHERE table_schema = DATABASE()`);
    return n(l.octets);
  }
}
