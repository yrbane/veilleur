/**
 * Veilleur - Notifications : Web Push après synchronisation, résumés courriel
 */

import type { DepotArticles } from '@/domaine/ports/DepotArticles';
import type { DepotNotifications, AbonnementPush, FrequenceResume } from '@/domaine/ports/DepotNotifications';
import type { EnvoyeurPush, ChargePush } from '@/domaine/ports/EnvoyeurPush';
import type { EnvoyeurCourriel } from '@/domaine/ports/EnvoyeurCourriel';
import type { ServiceCache } from '@/domaine/ports/ServiceCache';
import { composerResume } from './ResumeCourriel';

export interface ResultatSynchroSource {
  sourceId: string;
  nouveauxArticles: number;
}

export interface BilanPush {
  utilisateursNotifies: number;
  envois: number;
  abonnementsExpires: number;
}

export interface BilanResumes {
  destinataires: number;
  envoyes: number;
}

export interface OptionsServiceNotifications {
  /** Délai minimal entre deux pushs « nouveaux articles » pour un même utilisateur */
  intervallePushS?: number;
  urlApp?: string;
  /** Nombre d'articles listés dans un résumé */
  articlesParResume?: number;
}

const PREFIXE_CLE_PUSH = 'notifications:push:';

/**
 * Titre et corps d'une notification « nouveaux articles »
 */
export function composerPushNouveauxArticles(total: number, nomsSources: string[]): ChargePush {
  const titre = total > 1 ? `${total} nouveaux articles` : '1 nouvel article';
  const noms = [...new Set(nomsSources)];
  let corps: string;
  if (noms.length <= 3) {
    corps = noms.join(', ');
  } else {
    const reste = noms.length - 2;
    corps = `${noms.slice(0, 2).join(', ')} et ${reste} autres sources`;
  }
  return { titre, corps, url: '/?nonLus=1', tag: 'nouveaux-articles' };
}

export class ServiceNotifications {
  private readonly intervallePushS: number;
  private readonly urlApp: string;
  private readonly articlesParResume: number;

  constructor(
    private readonly depotNotifications: DepotNotifications,
    private readonly depotArticles: Pick<DepotArticles, 'listerFilUtilisateur'>,
    private readonly envoyeurPush: EnvoyeurPush,
    private readonly envoyeurCourriel: EnvoyeurCourriel,
    private readonly serviceCache: Pick<ServiceCache, 'obtenir' | 'stocker'>,
    options: OptionsServiceNotifications = {},
  ) {
    this.intervallePushS = options.intervallePushS ?? 1800;
    this.urlApp = (options.urlApp ?? '').replace(/\/$/, '');
    this.articlesParResume = options.articlesParResume ?? 30;
  }

  /**
   * Après une synchronisation : un push par utilisateur concerné, au plus un par intervalle
   */
  async notifierNouveauxArticles(resultats: ResultatSynchroSource[]): Promise<BilanPush> {
    const bilan: BilanPush = { utilisateursNotifies: 0, envois: 0, abonnementsExpires: 0 };
    if (!this.envoyeurPush.estConfigure()) return bilan;
    const nouveautes = new Map(resultats.filter(r => r.nouveauxArticles > 0).map(r => [r.sourceId, r.nouveauxArticles]));
    if (nouveautes.size === 0) return bilan;

    const abonnes = await this.depotNotifications.listerAbonnesSources([...nouveautes.keys()]);
    const parUtilisateur = new Map<string, { total: number; noms: string[] }>();
    for (const abonne of abonnes) {
      const entree = parUtilisateur.get(abonne.utilisateurId) ?? { total: 0, noms: [] };
      entree.total += nouveautes.get(abonne.sourceId) ?? 0;
      entree.noms.push(abonne.nomSource);
      parUtilisateur.set(abonne.utilisateurId, entree);
    }
    if (parUtilisateur.size === 0) return bilan;

    const abonnements = await this.depotNotifications.listerAbonnementsPush([...parUtilisateur.keys()]);
    const abonnementsParUtilisateur = new Map<string, AbonnementPush[]>();
    for (const a of abonnements) {
      abonnementsParUtilisateur.set(a.utilisateurId, [...(abonnementsParUtilisateur.get(a.utilisateurId) ?? []), a.abonnement]);
    }

    for (const [utilisateurId, { total, noms }] of parUtilisateur) {
      const cibles = abonnementsParUtilisateur.get(utilisateurId);
      if (!cibles || cibles.length === 0) continue;
      const cle = `${PREFIXE_CLE_PUSH}${utilisateurId}`;
      if (await this.serviceCache.obtenir<number>(cle)) continue;
      await this.serviceCache.stocker(cle, Date.now(), { ttl: this.intervallePushS });
      const charge = composerPushNouveauxArticles(total, noms);
      const envoyes = await this.envoyerPush(cibles, charge, bilan);
      if (envoyes > 0) bilan.utilisateursNotifies += 1;
    }
    return bilan;
  }

  /**
   * Push immédiat vers tous les appareils d'un utilisateur (test depuis les paramètres)
   */
  async envoyerPushTest(utilisateurId: string): Promise<number> {
    const abonnements = await this.depotNotifications.listerAbonnementsPush([utilisateurId]);
    const bilan: BilanPush = { utilisateursNotifies: 0, envois: 0, abonnementsExpires: 0 };
    return this.envoyerPush(
      abonnements.map(a => a.abonnement),
      { titre: 'Veilleur est prêt', corps: 'Vous serez prévenu des nouveaux articles de vos sources.', url: '/', tag: 'test' },
      bilan,
    );
  }

  private async envoyerPush(cibles: AbonnementPush[], charge: ChargePush, bilan: BilanPush): Promise<number> {
    let envoyes = 0;
    for (const abonnement of cibles) {
      const resultat = await this.envoyeurPush.envoyer(abonnement, charge);
      if (resultat === 'envoye') {
        envoyes += 1;
        bilan.envois += 1;
      } else if (resultat === 'expire') {
        bilan.abonnementsExpires += 1;
        await this.depotNotifications.supprimerAbonnementParEndpoint(abonnement.endpoint);
      }
    }
    return envoyes;
  }

  /**
   * Résumés courriel pour tous les abonnés à cette fréquence
   */
  async envoyerResumes(frequence: FrequenceResume, maintenant: Date = new Date()): Promise<BilanResumes> {
    const bilan: BilanResumes = { destinataires: 0, envoyes: 0 };
    if (!this.envoyeurCourriel.estConfigure()) return bilan;
    const destinataires = await this.depotNotifications.listerDestinatairesResume(frequence);
    bilan.destinataires = destinataires.length;
    for (const destinataire of destinataires) {
      if (await this.envoyerResume(destinataire.utilisateurId, destinataire.email, frequence, maintenant)) bilan.envoyes += 1;
    }
    return bilan;
  }

  /**
   * Résumé d'un seul utilisateur ; renvoie false s'il n'avait rien à lire ou si le courriel n'est pas configuré
   */
  async envoyerResume(utilisateurId: string, email: string, frequence: FrequenceResume, maintenant: Date = new Date()): Promise<boolean> {
    if (!this.envoyeurCourriel.estConfigure()) return false;
    const jours = frequence === 'quotidien' ? 1 : 7;
    const depuis = new Date(maintenant.getTime() - jours * 24 * 3600 * 1000);
    const resultat = await this.depotArticles.listerFilUtilisateur(utilisateurId, {
      depuis,
      nonLus: true,
      page: 1,
      limite: this.articlesParResume,
      tri: 'date',
      ordre: 'desc',
    });
    if (resultat.donnees.length === 0) return false;
    const courriel = composerResume({
      frequence,
      articles: resultat.donnees,
      total: resultat.pagination?.total ?? resultat.donnees.length,
      urlApp: this.urlApp,
      destinataire: email,
    });
    await this.envoyeurCourriel.envoyer(courriel);
    return true;
  }
}
