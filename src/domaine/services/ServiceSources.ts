/**
 * Veilleur - Service de gestion des sources
 * Logique métier pour l'ajout, la gestion et la synchronisation des sources
 */

import type { DepotSources, DepotParametresSources, CriteresSources, ResultatPagine } from '@/domaine/ports/DepotSources';
import type { Source, SourceUtilisateur, TypeSource } from '@/domaine/entites/Source';
import { normaliserUrl, SEUIL_ECHECS_SOURCE } from '@/domaine/entites/Source';
import type { ParametresSource, MiseAJourParametres } from '@/domaine/entites/ParametresSource';
import { createHash } from 'crypto';

/**
 * Résultat de la détection du type de source
 */
export interface ResultatDetection {
  type: TypeSource;
  titre: string | null;
  favicon: string | null;
}

/**
 * Erreurs du service sources
 */
export class ErreurSource extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'URL_INVALIDE'
      | 'SOURCE_INTROUVABLE'
      | 'SOURCE_DEJA_AJOUTEE'
      | 'LIMITE_SOURCES_ATTEINTE'
      | 'TYPE_NON_SUPPORTE'
      | 'ERREUR_DETECTION',
  ) {
    super(message);
    this.name = 'ErreurSource';
  }
}

/**
 * Limite de sources par utilisateur
 */
const LIMITE_SOURCES_UTILISATEUR = 100;

/**
 * Service de gestion des sources
 */
export class ServiceSources {
  constructor(
    private readonly depotSources: DepotSources,
    private readonly depotParametres: DepotParametresSources,
    private readonly detecteurSource?: (url: string) => Promise<ResultatDetection>,
  ) {}

  /**
   * Ajoute une nouvelle source pour un utilisateur
   */
  async ajouterSource(
    utilisateurId: string,
    url: string,
    nomPersonnalise?: string,
  ): Promise<SourceUtilisateur> {
    // Valider l'URL
    if (!this.estUrlValide(url)) {
      throw new ErreurSource('URL invalide', 'URL_INVALIDE');
    }

    // Vérifier la limite de sources
    const nombreSources = await this.depotSources.compterSourcesUtilisateur(utilisateurId);
    if (nombreSources >= LIMITE_SOURCES_UTILISATEUR) {
      throw new ErreurSource(
        `Limite de ${LIMITE_SOURCES_UTILISATEUR} sources atteinte`,
        'LIMITE_SOURCES_ATTEINTE',
      );
    }

    // Générer le hash de l'URL normalisée
    const hashUrl = this.genererHashUrl(url);

    // Vérifier si la source existe déjà globalement
    let source = await this.depotSources.trouverParHashUrl(hashUrl);

    if (source) {
      // Vérifier si l'utilisateur suit déjà cette source
      const dejaSuivie = await this.depotSources.utilisateurSuitSource(utilisateurId, source.id);
      if (dejaSuivie) {
        throw new ErreurSource('Vous suivez déjà cette source', 'SOURCE_DEJA_AJOUTEE');
      }
    } else {
      // Détecter le type de source et créer une nouvelle entrée
      const detection = await this.detecterTypeSource(url);

      source = await this.depotSources.creer({
        url,
        nom: nomPersonnalise ?? detection.titre ?? this.extraireNomDomaine(url),
        typeSource: detection.type,
        statut: 'active',
        urlFavicon: detection.favicon,
        dateDerniereSynchro: null,
        hashUrlNormalise: hashUrl,
        nombreEchecs: 0,
      });
    }

    // Ajouter la source à l'utilisateur
    const sourceUtilisateur = await this.depotSources.ajouterPourUtilisateur(
      utilisateurId,
      source.id,
    );

    return sourceUtilisateur;
  }

  /**
   * Retire une source pour un utilisateur
   */
  async retirerSource(utilisateurId: string, sourceId: string): Promise<boolean> {
    const suit = await this.depotSources.utilisateurSuitSource(utilisateurId, sourceId);
    if (!suit) {
      throw new ErreurSource('Source introuvable', 'SOURCE_INTROUVABLE');
    }

    return this.depotSources.retirerPourUtilisateur(utilisateurId, sourceId);
  }

  /**
   * Liste les sources d'un utilisateur
   */
  async listerSources(
    utilisateurId: string,
    criteres?: CriteresSources,
  ): Promise<ResultatPagine<SourceUtilisateur>> {
    return this.depotSources.listerPourUtilisateur(utilisateurId, criteres);
  }

  /**
   * Récupère une source spécifique d'un utilisateur
   */
  async obtenirSource(utilisateurId: string, sourceId: string): Promise<SourceUtilisateur | null> {
    const suit = await this.depotSources.utilisateurSuitSource(utilisateurId, sourceId);
    if (!suit) {
      return null;
    }

    const resultat = await this.depotSources.listerPourUtilisateur(utilisateurId, { limite: 1000 });
    return resultat.donnees.find(s => s.id === sourceId) ?? null;
  }

  /**
   * Note une source
   */
  async noterSource(
    utilisateurId: string,
    sourceId: string,
    note: number | null,
  ): Promise<boolean> {
    if (note !== null && (note < 1 || note > 5)) {
      throw new ErreurSource('La note doit être entre 1 et 5', 'URL_INVALIDE');
    }

    const suit = await this.depotSources.utilisateurSuitSource(utilisateurId, sourceId);
    if (!suit) {
      throw new ErreurSource('Source introuvable', 'SOURCE_INTROUVABLE');
    }

    return this.depotSources.noterSource(utilisateurId, sourceId, note);
  }

  /**
   * Met en pause ou réactive une source
   */
  async basculerPause(
    utilisateurId: string,
    sourceId: string,
    enPause: boolean,
  ): Promise<boolean> {
    const suit = await this.depotSources.utilisateurSuitSource(utilisateurId, sourceId);
    if (!suit) {
      throw new ErreurSource('Source introuvable', 'SOURCE_INTROUVABLE');
    }

    return this.depotSources.basculerPause(utilisateurId, sourceId, enPause);
  }

  /**
   * Récupère les paramètres d'une source pour un utilisateur
   * Note: Cette implémentation simplifiée utilise l'ID de source comme clé
   */
  async obtenirParametres(
    utilisateurId: string,
    sourceId: string,
  ): Promise<ParametresSource> {
    const suit = await this.depotSources.utilisateurSuitSource(utilisateurId, sourceId);
    if (!suit) {
      throw new ErreurSource('Source introuvable', 'SOURCE_INTROUVABLE');
    }

    // Essayer de récupérer les paramètres existants
    const parametres = await this.depotParametres.trouverParUtilisateurSource(sourceId);

    if (parametres) {
      return parametres;
    }

    // Créer les paramètres par défaut si inexistants
    return this.depotParametres.creerDefaut(sourceId);
  }

  /**
   * Met à jour les paramètres d'une source
   */
  async mettreAJourParametres(
    utilisateurId: string,
    sourceId: string,
    parametres: MiseAJourParametres,
  ): Promise<ParametresSource | null> {
    const suit = await this.depotSources.utilisateurSuitSource(utilisateurId, sourceId);
    if (!suit) {
      throw new ErreurSource('Source introuvable', 'SOURCE_INTROUVABLE');
    }

    // S'assurer que les paramètres existent
    let existants = await this.depotParametres.trouverParUtilisateurSource(sourceId);
    if (!existants) {
      existants = await this.depotParametres.creerDefaut(sourceId);
    }

    // Mettre à jour
    return this.depotParametres.mettreAJour(sourceId, parametres);
  }

  /**
   * Marque une synchronisation réussie
   */
  async marquerSynchroReussie(sourceId: string): Promise<void> {
    await this.depotSources.mettreAJour(sourceId, {
      dateDerniereSynchro: new Date(),
      statut: 'active',
    });
    await this.depotSources.reinitialiserEchecs(sourceId);
  }

  /**
   * Marque un échec de synchronisation
   */
  async marquerSynchroEchouee(sourceId: string): Promise<void> {
    const echecs = await this.depotSources.incrementerEchecs(sourceId);

    if (echecs >= SEUIL_ECHECS_SOURCE) {
      await this.depotSources.mettreAJour(sourceId, { statut: 'erreur' });
    }
  }

  /**
   * Liste les sources à rafraîchir
   */
  async listerSourcesARafraichir(limite?: number): Promise<Source[]> {
    return this.depotSources.listerSourcesARafraichir(limite);
  }

  /**
   * Valide une URL
   */
  private estUrlValide(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Génère un hash MD5 de l'URL normalisée
   */
  private genererHashUrl(url: string): string {
    const normalise = normaliserUrl(url);
    return createHash('md5').update(normalise).digest('hex');
  }

  /**
   * Extrait le nom de domaine d'une URL
   */
  private extraireNomDomaine(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  /**
   * Détecte le type de source (RSS, Atom, HTML)
   */
  private async detecterTypeSource(url: string): Promise<ResultatDetection> {
    if (this.detecteurSource) {
      try {
        return await this.detecteurSource(url);
      } catch {
        // Fallback si la détection échoue
      }
    }

    // Détection basique par extension/path
    const urlLower = url.toLowerCase();
    if (urlLower.includes('/feed') || urlLower.includes('.rss') || urlLower.includes('/rss')) {
      return { type: 'rss', titre: null, favicon: null };
    }
    if (urlLower.includes('/atom') || urlLower.includes('.atom')) {
      return { type: 'atom', titre: null, favicon: null };
    }

    // Par défaut, on essaie RSS (le plus courant)
    return { type: 'rss', titre: null, favicon: null };
  }
}
