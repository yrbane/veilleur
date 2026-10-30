/**
 * Veilleur - Service d'administration : tableau de bord (statistiques anonymes),
 * gestion des comptes et des sources. Les agrégats viennent du dépôt ; ici les règles.
 */

import type { RoleUtilisateur } from '@/domaine/entites/Utilisateur';

/** Un point d'une série journalière (jour au format AAAA-MM-JJ) */
export interface PointSerie {
  jour: string;
  valeur: number;
}

export interface CompteursUtilisateurs {
  total: number;
  actifs: number;
  admins: number;
  avec2fa: number;
  nouveaux7j: number;
  connectes7j: number;
  abonnesPush: number;
}

export interface CompteursSources {
  total: number;
  parType: Record<string, number>;
  parStatut: Record<string, number>;
  enEchec: number;
  abonnements: number;
  enPause: number;
}

export interface CompteursArticles {
  total: number;
  dernieres24h: number;
  derniers7j: number;
  avecImage: number;
  imagesCachees: number;
}

export interface CompteursAnnotations {
  lus: number;
  notes: number;
  favoris: number;
  aLire: number;
  noteMoyenne: number | null;
  /** Nombre d'annotations par note, index 0 = 1 étoile … index 4 = 5 étoiles */
  repartitionNotes: number[];
}

export interface CompteursImages {
  parStatut: Record<string, number>;
  octets: number;
}

export interface SourceAdmin {
  id: string;
  nom: string;
  url: string;
  typeSource: string;
  statut: string;
  urlFavicon: string | null;
  nombreEchecs: number;
  dateDerniereSynchro: Date | null;
  abonnes: number;
  articles: number;
}

export interface UtilisateurAdmin {
  id: string;
  email: string;
  role: RoleUtilisateur;
  estActif: boolean;
  totpActif: boolean;
  dateCreation: Date;
  dateDerniereConnexion: Date | null;
  nombreSources: number;
  nombreLectures: number;
}

export interface TableauDeBord {
  utilisateurs: CompteursUtilisateurs;
  sources: CompteursSources;
  articles: CompteursArticles;
  annotations: CompteursAnnotations;
  images: CompteursImages;
  series: {
    jours: number;
    inscriptions: PointSerie[];
    articles: PointSerie[];
    lectures: PointSerie[];
  };
  /** Articles publiés par heure de la journée sur les 30 derniers jours, index = heure */
  articlesParHeure: number[];
  topSources: SourceAdmin[];
  tagsPopulaires: Array<{ nom: string; slug: string; nombreSources: number }>;
  motsClesFrequents: Array<{ mot: string; nombre: number }>;
}

export type OrdreTri = 'asc' | 'desc';

export interface OptionsListe {
  page: number;
  limite: number;
  recherche?: string;
  /** Clé de tri (voir TRIS_UTILISATEURS / TRIS_SOURCES) ; inconnue → tri par défaut */
  tri?: string;
  ordre?: OrdreTri;
}

/** Une colonne triable : expression SQL (alias ou colonne) et ordre naturel */
export interface ColonneTri {
  expression: string;
  ordre: OrdreTri;
}

export interface TrisListe {
  colonnes: Record<string, ColonneTri>;
  defaut: ColonneTri;
}

/** Les libellés se lisent de A à Z, les compteurs et dates du plus grand ou récent au plus petit */
export const TRIS_UTILISATEURS: TrisListe = {
  colonnes: {
    email: { expression: 'u.email', ordre: 'asc' },
    role: { expression: 'u.role', ordre: 'asc' },
    dateCreation: { expression: 'u.date_creation', ordre: 'desc' },
    dateDerniereConnexion: { expression: 'u.date_derniere_connexion', ordre: 'desc' },
    nombreSources: { expression: 'nombreSources', ordre: 'desc' },
    nombreLectures: { expression: 'nombreLectures', ordre: 'desc' },
  },
  defaut: { expression: 'u.date_creation', ordre: 'desc' },
};

export const TRIS_SOURCES: TrisListe = {
  colonnes: {
    nom: { expression: 's.nom', ordre: 'asc' },
    typeSource: { expression: 's.type_source', ordre: 'asc' },
    statut: { expression: 's.statut', ordre: 'asc' },
    nombreEchecs: { expression: 's.nombre_echecs', ordre: 'desc' },
    abonnes: { expression: 'abonnes', ordre: 'desc' },
    articles: { expression: 'articles', ordre: 'desc' },
    dateDerniereSynchro: { expression: 's.date_derniere_synchro', ordre: 'desc' },
  },
  defaut: { expression: 's.nombre_echecs', ordre: 'desc' },
};

/**
 * Résout la clé de tri demandée contre la liste blanche : jamais d'expression venue du client dans le SQL
 */
export function resoudreTri(tris: TrisListe, tri: string | undefined, ordre: OrdreTri | undefined): ColonneTri {
  const colonne = tri !== undefined && Object.prototype.hasOwnProperty.call(tris.colonnes, tri) ? tris.colonnes[tri]! : tris.defaut;
  return { expression: colonne.expression, ordre: ordre ?? colonne.ordre };
}

export interface ResultatListe<T> {
  donnees: T[];
  total: number;
}

export interface ChangementsUtilisateur {
  role?: RoleUtilisateur;
  estActif?: boolean;
}

/**
 * Port : agrégats et accès bruts nécessaires à l'administration
 */
export interface DepotAdministration {
  compterUtilisateurs(): Promise<CompteursUtilisateurs>;
  compterSources(): Promise<CompteursSources>;
  compterArticles(): Promise<CompteursArticles>;
  compterAnnotations(): Promise<CompteursAnnotations>;
  compterImages(): Promise<CompteursImages>;
  serieInscriptions(jours: number): Promise<PointSerie[]>;
  serieArticles(jours: number): Promise<PointSerie[]>;
  serieLectures(jours: number): Promise<PointSerie[]>;
  articlesParHeure(jours: number): Promise<Array<{ heure: number; nombre: number }>>;
  listerTopSources(limite: number): Promise<SourceAdmin[]>;
  listerTagsPopulaires(limite: number): Promise<Array<{ nom: string; slug: string; nombreSources: number }>>;
  listerMotsClesFrequents(limite: number): Promise<Array<{ mot: string; nombre: number }>>;
  listerUtilisateurs(options: OptionsListe): Promise<ResultatListe<UtilisateurAdmin>>;
  trouverUtilisateur(id: string): Promise<UtilisateurAdmin | null>;
  mettreAJourUtilisateur(id: string, changements: ChangementsUtilisateur): Promise<void>;
  supprimerUtilisateur(id: string): Promise<void>;
  listerSources(options: OptionsListe): Promise<ResultatListe<SourceAdmin>>;
}

export class ErreurAdministration extends Error {
  constructor(
    message: string,
    public readonly code: 'UTILISATEUR_INTROUVABLE' | 'AUTO_MODIFICATION' | 'DERNIER_ADMIN',
  ) {
    super(message);
    this.name = 'ErreurAdministration';
  }
}

/** Jour local au format AAAA-MM-JJ */
export function cleJour(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Complète une série creuse : un point par jour sur les `jours` derniers jours (aujourd'hui inclus),
 * à zéro là où la base n'a rien renvoyé, dans l'ordre chronologique.
 */
export function completerSerie(points: PointSerie[], jours: number, aujourdhui: Date = new Date()): PointSerie[] {
  const valeurs = new Map(points.map(p => [p.jour.slice(0, 10), Number(p.valeur) || 0]));
  const serie: PointSerie[] = [];
  for (let i = jours - 1; i >= 0; i--) {
    const date = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - i);
    const jour = cleJour(date);
    serie.push({ jour, valeur: valeurs.get(jour) ?? 0 });
  }
  return serie;
}

/** Répartit des comptes par heure sur 24 cases */
export function completerHeures(points: Array<{ heure: number; nombre: number }>): number[] {
  const heures = new Array<number>(24).fill(0);
  for (const { heure, nombre } of points) {
    if (heure >= 0 && heure < 24) heures[heure] = Number(nombre) || 0;
  }
  return heures;
}

export const JOURS_SERIES = 30;

export class ServiceAdministration {
  constructor(private readonly depot: DepotAdministration) {}

  async tableauDeBord(aujourdhui: Date = new Date()): Promise<TableauDeBord> {
    const [utilisateurs, sources, articles, annotations, images, inscriptions, serieArticles, lectures, heures, topSources, tagsPopulaires, motsClesFrequents] =
      await Promise.all([
        this.depot.compterUtilisateurs(),
        this.depot.compterSources(),
        this.depot.compterArticles(),
        this.depot.compterAnnotations(),
        this.depot.compterImages(),
        this.depot.serieInscriptions(JOURS_SERIES),
        this.depot.serieArticles(JOURS_SERIES),
        this.depot.serieLectures(JOURS_SERIES),
        this.depot.articlesParHeure(JOURS_SERIES),
        this.depot.listerTopSources(10),
        this.depot.listerTagsPopulaires(12),
        this.depot.listerMotsClesFrequents(15),
      ]);
    return {
      utilisateurs,
      sources,
      articles,
      annotations,
      images,
      series: {
        jours: JOURS_SERIES,
        inscriptions: completerSerie(inscriptions, JOURS_SERIES, aujourdhui),
        articles: completerSerie(serieArticles, JOURS_SERIES, aujourdhui),
        lectures: completerSerie(lectures, JOURS_SERIES, aujourdhui),
      },
      articlesParHeure: completerHeures(heures),
      topSources,
      tagsPopulaires,
      motsClesFrequents,
    };
  }

  listerUtilisateurs(options: OptionsListe): Promise<ResultatListe<UtilisateurAdmin>> {
    return this.depot.listerUtilisateurs(options);
  }

  listerSources(options: OptionsListe): Promise<ResultatListe<SourceAdmin>> {
    return this.depot.listerSources(options);
  }

  /**
   * Change le rôle ou l'activation d'un compte. Un administrateur ne peut ni se rétrograder,
   * ni se désactiver, ni priver l'instance de son dernier administrateur.
   */
  async modifierUtilisateur(adminId: string, cibleId: string, changements: ChangementsUtilisateur): Promise<UtilisateurAdmin> {
    const cible = await this.depot.trouverUtilisateur(cibleId);
    if (!cible) throw new ErreurAdministration('Utilisateur introuvable', 'UTILISATEUR_INTROUVABLE');

    const retireAdmin = cible.role === 'admin' && (changements.role === 'membre' || changements.estActif === false);
    if (cibleId === adminId && retireAdmin) {
      throw new ErreurAdministration('Vous ne pouvez pas retirer vos propres droits', 'AUTO_MODIFICATION');
    }
    if (retireAdmin) await this.verifierDernierAdmin();

    await this.depot.mettreAJourUtilisateur(cibleId, changements);
    return (await this.depot.trouverUtilisateur(cibleId)) ?? { ...cible, ...changements };
  }

  async supprimerUtilisateur(adminId: string, cibleId: string): Promise<void> {
    if (cibleId === adminId) {
      throw new ErreurAdministration('Vous ne pouvez pas supprimer votre propre compte ici', 'AUTO_MODIFICATION');
    }
    const cible = await this.depot.trouverUtilisateur(cibleId);
    if (!cible) throw new ErreurAdministration('Utilisateur introuvable', 'UTILISATEUR_INTROUVABLE');
    if (cible.role === 'admin') await this.verifierDernierAdmin();
    await this.depot.supprimerUtilisateur(cibleId);
  }

  private async verifierDernierAdmin(): Promise<void> {
    const { admins } = await this.depot.compterUtilisateurs();
    if (admins <= 1) {
      throw new ErreurAdministration('Impossible : il ne resterait plus aucun administrateur', 'DERNIER_ADMIN');
    }
  }
}
