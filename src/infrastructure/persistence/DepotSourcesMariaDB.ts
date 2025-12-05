/**
 * Veilleur - Implémentation du dépôt sources avec MariaDB
 */

import { eq, and, lt, sql, isNull, or, desc, like } from 'drizzle-orm';
import type {
  DepotSources,
  DepotParametresSources,
  CriteresSources,
  ResultatPagine,
  CriteresCommunaute,
  SourcePopulaire,
  TagPopulaire,
} from '@/domaine/ports/DepotSources';
import type { Source, SourceUtilisateur, TypeSource, StatutSource } from '@/domaine/entites/Source';
import type { ParametresSource, MiseAJourParametres, FiltresMotsCles, PlageHoraire } from '@/domaine/entites/ParametresSource';
import { PARAMETRES_DEFAUT } from '@/domaine/entites/ParametresSource';
import { obtenirBdd } from './connexion';
import {
  sources,
  utilisateursSources,
  parametresSources,
  utilisateursSourcesTags,
  tags,
} from './schema';
import { loggerBdd } from '../logging/logger';
import { createId } from '@paralleldrive/cuid2';

/**
 * Implémentation du dépôt sources avec Drizzle ORM
 */
export class DepotSourcesMariaDB implements DepotSources {
  async trouverParId(id: string): Promise<Source | null> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select()
        .from(sources)
        .where(eq(sources.id, id))
        .limit(1);

      const result = resultats[0];
      if (!result) {
        return null;
      }

      return this.versSource(result);
    } catch (erreur) {
      loggerBdd.error({ erreur, id }, 'Erreur lors de la recherche source par ID');
      throw erreur;
    }
  }

  async trouverParHashUrl(hashUrl: string): Promise<Source | null> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select()
        .from(sources)
        .where(eq(sources.hashUrlNormalise, hashUrl))
        .limit(1);

      const result = resultats[0];
      if (!result) {
        return null;
      }

      return this.versSource(result);
    } catch (erreur) {
      loggerBdd.error({ erreur, hashUrl }, 'Erreur lors de la recherche source par hash');
      throw erreur;
    }
  }

  async creer(donnees: Omit<Source, 'id' | 'dateCreation'>): Promise<Source> {
    const db = obtenirBdd();
    const id = createId();
    const dateCreation = new Date();

    try {
      await db.insert(sources).values({
        id,
        url: donnees.url,
        nom: donnees.nom,
        typeSource: donnees.typeSource,
        statut: donnees.statut ?? 'active',
        urlFavicon: donnees.urlFavicon,
        dateCreation,
        dateDerniereSynchro: donnees.dateDerniereSynchro,
        hashUrlNormalise: donnees.hashUrlNormalise,
        nombreEchecs: donnees.nombreEchecs ?? 0,
      });

      loggerBdd.info({ id, nom: donnees.nom }, 'Source créée');

      return {
        id,
        ...donnees,
        dateCreation,
        nombreEchecs: donnees.nombreEchecs ?? 0,
      };
    } catch (erreur) {
      loggerBdd.error({ erreur, url: donnees.url }, 'Erreur lors de la création source');
      throw erreur;
    }
  }

  async mettreAJour(id: string, donnees: Partial<Source>): Promise<Source | null> {
    const db = obtenirBdd();

    try {
      const updateData: Record<string, unknown> = {};

      if (donnees.nom !== undefined) updateData.nom = donnees.nom;
      if (donnees.url !== undefined) updateData.url = donnees.url;
      if (donnees.typeSource !== undefined) updateData.typeSource = donnees.typeSource;
      if (donnees.statut !== undefined) updateData.statut = donnees.statut;
      if (donnees.urlFavicon !== undefined) updateData.urlFavicon = donnees.urlFavicon;
      if (donnees.dateDerniereSynchro !== undefined) updateData.dateDerniereSynchro = donnees.dateDerniereSynchro;
      if (donnees.hashUrlNormalise !== undefined) updateData.hashUrlNormalise = donnees.hashUrlNormalise;
      if (donnees.nombreEchecs !== undefined) updateData.nombreEchecs = donnees.nombreEchecs;

      if (Object.keys(updateData).length === 0) {
        return this.trouverParId(id);
      }

      await db.update(sources).set(updateData).where(eq(sources.id, id));

      loggerBdd.info({ id }, 'Source mise à jour');

      return this.trouverParId(id);
    } catch (erreur) {
      loggerBdd.error({ erreur, id }, 'Erreur lors de la mise à jour source');
      throw erreur;
    }
  }

  async supprimer(id: string): Promise<boolean> {
    const db = obtenirBdd();

    try {
      // Vérifier si des utilisateurs suivent encore cette source
      const abonnements = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(utilisateursSources)
        .where(eq(utilisateursSources.sourceId, id));

      const abonnementCount = abonnements[0]?.count ?? 0;
      if (abonnementCount > 0) {
        loggerBdd.warn({ id, abonnements: abonnementCount }, 'Source non supprimée car suivie');
        return false;
      }

      const resultat = await db.delete(sources).where(eq(sources.id, id));
      const affecte = (resultat as unknown as { affectedRows: number }).affectedRows > 0;

      if (affecte) {
        loggerBdd.info({ id }, 'Source supprimée');
      }

      return affecte;
    } catch (erreur) {
      loggerBdd.error({ erreur, id }, 'Erreur lors de la suppression source');
      throw erreur;
    }
  }

  async listerPourUtilisateur(
    utilisateurId: string,
    criteres?: CriteresSources,
  ): Promise<ResultatPagine<SourceUtilisateur>> {
    const db = obtenirBdd();
    const page = criteres?.page ?? 1;
    const limite = criteres?.limite ?? 20;
    const offset = (page - 1) * limite;

    try {
      // Construire les conditions
      const conditions = [eq(utilisateursSources.utilisateurId, utilisateurId)];

      if (criteres?.statut && criteres.statut !== 'toutes') {
        conditions.push(eq(sources.statut, criteres.statut));
      }

      // Compter le total
      const totalResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(utilisateursSources)
        .innerJoin(sources, eq(utilisateursSources.sourceId, sources.id))
        .where(and(...conditions));

      const total = totalResult[0]?.count ?? 0;

      // Récupérer les sources
      const resultats = await db
        .select({
          source: sources,
          utilisateurSource: utilisateursSources,
        })
        .from(utilisateursSources)
        .innerJoin(sources, eq(utilisateursSources.sourceId, sources.id))
        .where(and(...conditions))
        .orderBy(utilisateursSources.dateAjout)
        .limit(limite)
        .offset(offset);

      // Récupérer les tags pour chaque source
      const sourcesAvecTags = await Promise.all(
        resultats.map(async r => {
          const tagsSource = await db
            .select({
              id: tags.id,
              nom: tags.nom,
              slug: tags.slug,
            })
            .from(utilisateursSourcesTags)
            .innerJoin(tags, eq(utilisateursSourcesTags.tagId, tags.id))
            .where(eq(utilisateursSourcesTags.utilisateurSourceId, r.utilisateurSource.id));

          return this.versSourceUtilisateur(r.source, r.utilisateurSource, tagsSource);
        }),
      );

      return {
        donnees: sourcesAvecTags,
        pagination: {
          page,
          limite,
          total,
          totalPages: Math.ceil(total / limite),
        },
      };
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId }, 'Erreur lors du listing des sources');
      throw erreur;
    }
  }

  async ajouterPourUtilisateur(
    utilisateurId: string,
    sourceId: string,
  ): Promise<SourceUtilisateur> {
    const db = obtenirBdd();
    const id = createId();

    try {
      await db.insert(utilisateursSources).values({
        id,
        utilisateurId,
        sourceId,
        dateAjout: new Date(),
        note: null,
        estEnPause: false,
      });

      loggerBdd.info({ utilisateurId, sourceId }, 'Source ajoutée à l\'utilisateur');

      const source = await this.trouverParId(sourceId);
      if (!source) {
        throw new Error('Source introuvable après ajout');
      }

      return {
        ...source,
        dateAjout: new Date(),
        note: null,
        estEnPause: false,
        tags: [],
      };
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId, sourceId }, 'Erreur lors de l\'ajout source');
      throw erreur;
    }
  }

  async retirerPourUtilisateur(utilisateurId: string, sourceId: string): Promise<boolean> {
    const db = obtenirBdd();

    try {
      // Trouver l'association
      const associations = await db
        .select({ id: utilisateursSources.id })
        .from(utilisateursSources)
        .where(
          and(
            eq(utilisateursSources.utilisateurId, utilisateurId),
            eq(utilisateursSources.sourceId, sourceId),
          ),
        )
        .limit(1);

      const association = associations[0];
      if (!association) {
        return false;
      }

      const utilisateurSourceId = association.id;

      // Supprimer les tags associés
      await db
        .delete(utilisateursSourcesTags)
        .where(eq(utilisateursSourcesTags.utilisateurSourceId, utilisateurSourceId));

      // Supprimer les paramètres
      await db
        .delete(parametresSources)
        .where(eq(parametresSources.utilisateurSourceId, utilisateurSourceId));

      // Supprimer l'association
      const resultat = await db
        .delete(utilisateursSources)
        .where(eq(utilisateursSources.id, utilisateurSourceId));

      const affecte = (resultat as unknown as { affectedRows: number }).affectedRows > 0;

      if (affecte) {
        loggerBdd.info({ utilisateurId, sourceId }, 'Source retirée de l\'utilisateur');
      }

      return affecte;
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId, sourceId }, 'Erreur lors du retrait source');
      throw erreur;
    }
  }

  async utilisateurSuitSource(utilisateurId: string, sourceId: string): Promise<boolean> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select({ id: utilisateursSources.id })
        .from(utilisateursSources)
        .where(
          and(
            eq(utilisateursSources.utilisateurId, utilisateurId),
            eq(utilisateursSources.sourceId, sourceId),
          ),
        )
        .limit(1);

      return resultats.length > 0;
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId, sourceId }, 'Erreur lors de la vérification abonnement');
      throw erreur;
    }
  }

  async noterSource(
    utilisateurId: string,
    sourceId: string,
    note: number | null,
  ): Promise<boolean> {
    const db = obtenirBdd();

    try {
      const resultat = await db
        .update(utilisateursSources)
        .set({ note })
        .where(
          and(
            eq(utilisateursSources.utilisateurId, utilisateurId),
            eq(utilisateursSources.sourceId, sourceId),
          ),
        );

      return (resultat as unknown as { affectedRows: number }).affectedRows > 0;
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId, sourceId, note }, 'Erreur lors de la notation source');
      throw erreur;
    }
  }

  async basculerPause(
    utilisateurId: string,
    sourceId: string,
    estEnPause: boolean,
  ): Promise<boolean> {
    const db = obtenirBdd();

    try {
      const resultat = await db
        .update(utilisateursSources)
        .set({ estEnPause })
        .where(
          and(
            eq(utilisateursSources.utilisateurId, utilisateurId),
            eq(utilisateursSources.sourceId, sourceId),
          ),
        );

      return (resultat as unknown as { affectedRows: number }).affectedRows > 0;
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId, sourceId }, 'Erreur lors du basculement pause');
      throw erreur;
    }
  }

  async incrementerEchecs(id: string): Promise<number> {
    const db = obtenirBdd();

    try {
      await db
        .update(sources)
        .set({ nombreEchecs: sql`${sources.nombreEchecs} + 1` })
        .where(eq(sources.id, id));

      const resultat = await db
        .select({ nombreEchecs: sources.nombreEchecs })
        .from(sources)
        .where(eq(sources.id, id))
        .limit(1);

      return resultat[0]?.nombreEchecs ?? 0;
    } catch (erreur) {
      loggerBdd.error({ erreur, id }, 'Erreur lors de l\'incrémentation échecs');
      throw erreur;
    }
  }

  async reinitialiserEchecs(id: string): Promise<void> {
    const db = obtenirBdd();

    try {
      await db.update(sources).set({ nombreEchecs: 0 }).where(eq(sources.id, id));
    } catch (erreur) {
      loggerBdd.error({ erreur, id }, 'Erreur lors de la réinitialisation échecs');
      throw erreur;
    }
  }

  async listerSourcesARafraichir(limite = 50): Promise<Source[]> {
    const db = obtenirBdd();
    const ilYa30Minutes = new Date(Date.now() - 30 * 60 * 1000);

    try {
      const resultats = await db
        .select()
        .from(sources)
        .where(
          and(
            eq(sources.statut, 'active'),
            or(
              isNull(sources.dateDerniereSynchro),
              lt(sources.dateDerniereSynchro, ilYa30Minutes),
            ),
          ),
        )
        .orderBy(sources.dateDerniereSynchro)
        .limit(limite);

      return resultats.map(r => this.versSource(r));
    } catch (erreur) {
      loggerBdd.error({ erreur }, 'Erreur lors du listing sources à rafraîchir');
      throw erreur;
    }
  }

  async compterSourcesUtilisateur(utilisateurId: string): Promise<number> {
    const db = obtenirBdd();

    try {
      const resultat = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(utilisateursSources)
        .where(eq(utilisateursSources.utilisateurId, utilisateurId));

      return resultat[0]?.count ?? 0;
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurId }, 'Erreur lors du comptage sources');
      throw erreur;
    }
  }

  async listerSourcesPopulaires(
    criteres: CriteresCommunaute,
  ): Promise<ResultatPagine<SourcePopulaire>> {
    const db = obtenirBdd();
    const page = criteres.page ?? 1;
    const limite = criteres.limite ?? 20;
    const offset = (page - 1) * limite;

    try {
      // Construire les conditions
      const conditions: ReturnType<typeof eq>[] = [eq(sources.statut, 'active')];

      if (criteres.recherche) {
        conditions.push(like(sources.nom, `%${criteres.recherche}%`));
      }

      // Compter le total de sources avec abonnés
      const totalResult = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${sources.id})` })
        .from(sources)
        .innerJoin(utilisateursSources, eq(sources.id, utilisateursSources.sourceId))
        .where(and(...conditions));

      const total = totalResult[0]?.count ?? 0;

      // Déterminer l'ordre
      let orderBy;
      switch (criteres.tri) {
        case 'note':
          orderBy = desc(sql`AVG(${utilisateursSources.note})`);
          break;
        case 'recent':
          orderBy = desc(sources.dateCreation);
          break;
        case 'populaire':
        default:
          orderBy = desc(sql`COUNT(${utilisateursSources.id})`);
      }

      // Récupérer les sources avec stats
      const resultats = await db
        .select({
          id: sources.id,
          url: sources.url,
          nom: sources.nom,
          typeSource: sources.typeSource,
          statut: sources.statut,
          urlFavicon: sources.urlFavicon,
          nombreUtilisateurs: sql<number>`COUNT(${utilisateursSources.id})`,
          noteMoyenne: sql<number | null>`AVG(${utilisateursSources.note})`,
        })
        .from(sources)
        .innerJoin(utilisateursSources, eq(sources.id, utilisateursSources.sourceId))
        .where(and(...conditions))
        .groupBy(sources.id)
        .orderBy(orderBy)
        .limit(limite)
        .offset(offset);

      // Récupérer les tags pour chaque source
      const sourcesAvecTags: SourcePopulaire[] = await Promise.all(
        resultats.map(async r => {
          // Récupérer les tags les plus utilisés pour cette source
          const tagsSource = await db
            .select({
              id: tags.id,
              nom: tags.nom,
              slug: tags.slug,
              count: sql<number>`COUNT(*)`,
            })
            .from(utilisateursSourcesTags)
            .innerJoin(tags, eq(utilisateursSourcesTags.tagId, tags.id))
            .innerJoin(utilisateursSources, eq(utilisateursSourcesTags.utilisateurSourceId, utilisateursSources.id))
            .where(eq(utilisateursSources.sourceId, r.id))
            .groupBy(tags.id)
            .orderBy(desc(sql`COUNT(*)`))
            .limit(5);

          return {
            id: r.id,
            url: r.url,
            nom: r.nom,
            typeSource: r.typeSource as 'rss' | 'atom' | 'html',
            statut: r.statut as 'active' | 'inactive' | 'erreur',
            urlFavicon: r.urlFavicon,
            nombreUtilisateurs: r.nombreUtilisateurs,
            noteMoyenne: r.noteMoyenne,
            tags: tagsSource.map(t => ({ id: t.id, nom: t.nom, slug: t.slug })),
          };
        }),
      );

      // Filtrer par tag si spécifié
      let donneesFinales = sourcesAvecTags;
      if (criteres.tag) {
        donneesFinales = sourcesAvecTags.filter(s =>
          s.tags.some(t => t.slug === criteres.tag),
        );
      }

      return {
        donnees: donneesFinales,
        pagination: {
          page,
          limite,
          total,
          totalPages: Math.ceil(total / limite),
        },
      };
    } catch (erreur) {
      loggerBdd.error({ erreur }, 'Erreur lors du listing sources populaires');
      throw erreur;
    }
  }

  async listerTagsPopulaires(limite = 20): Promise<TagPopulaire[]> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select({
          id: tags.id,
          nom: tags.nom,
          slug: tags.slug,
          nombreSources: sql<number>`COUNT(DISTINCT ${utilisateursSources.sourceId})`,
        })
        .from(tags)
        .innerJoin(utilisateursSourcesTags, eq(tags.id, utilisateursSourcesTags.tagId))
        .innerJoin(utilisateursSources, eq(utilisateursSourcesTags.utilisateurSourceId, utilisateursSources.id))
        .groupBy(tags.id)
        .orderBy(desc(sql`COUNT(DISTINCT ${utilisateursSources.sourceId})`))
        .limit(limite);

      return resultats;
    } catch (erreur) {
      loggerBdd.error({ erreur }, 'Erreur lors du listing tags populaires');
      throw erreur;
    }
  }

  private versSource(row: typeof sources.$inferSelect): Source {
    return {
      id: row.id,
      url: row.url,
      nom: row.nom,
      typeSource: row.typeSource as TypeSource,
      statut: (row.statut ?? 'active') as StatutSource,
      urlFavicon: row.urlFavicon,
      dateCreation: row.dateCreation,
      dateDerniereSynchro: row.dateDerniereSynchro,
      hashUrlNormalise: row.hashUrlNormalise,
      nombreEchecs: row.nombreEchecs ?? 0,
    };
  }

  private versSourceUtilisateur(
    sourceRow: typeof sources.$inferSelect,
    usRow: typeof utilisateursSources.$inferSelect,
    tagsData: { id: string; nom: string; slug: string }[],
  ): SourceUtilisateur {
    return {
      ...this.versSource(sourceRow),
      dateAjout: usRow.dateAjout,
      note: usRow.note,
      estEnPause: usRow.estEnPause ?? false,
      tags: tagsData,
    };
  }
}

/**
 * Implémentation du dépôt paramètres sources avec Drizzle ORM
 */
export class DepotParametresSourcesMariaDB implements DepotParametresSources {
  async trouverParUtilisateurSource(utilisateurSourceId: string): Promise<ParametresSource | null> {
    const db = obtenirBdd();

    try {
      const resultats = await db
        .select()
        .from(parametresSources)
        .where(eq(parametresSources.utilisateurSourceId, utilisateurSourceId))
        .limit(1);

      const result = resultats[0];
      if (!result) {
        return null;
      }

      return this.versParametres(result);
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurSourceId }, 'Erreur lors de la recherche paramètres');
      throw erreur;
    }
  }

  async creerDefaut(utilisateurSourceId: string): Promise<ParametresSource> {
    const db = obtenirBdd();
    const id = createId();

    try {
      await db.insert(parametresSources).values({
        id,
        utilisateurSourceId,
        ...PARAMETRES_DEFAUT,
      });

      loggerBdd.info({ utilisateurSourceId }, 'Paramètres par défaut créés');

      return {
        id,
        utilisateurSourceId,
        ...PARAMETRES_DEFAUT,
      };
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurSourceId }, 'Erreur lors de la création paramètres');
      throw erreur;
    }
  }

  async mettreAJour(
    utilisateurSourceId: string,
    donnees: MiseAJourParametres,
  ): Promise<ParametresSource | null> {
    const db = obtenirBdd();

    try {
      const updateData: Record<string, unknown> = {};

      if (donnees.nombreMaxArticles !== undefined) updateData.nombreMaxArticles = donnees.nombreMaxArticles;
      if (donnees.frequenceMinutes !== undefined) updateData.frequenceMinutes = donnees.frequenceMinutes;
      if (donnees.retentionJours !== undefined) updateData.retentionJours = donnees.retentionJours;
      if (donnees.priorite !== undefined) updateData.priorite = donnees.priorite;
      if (donnees.modeExtraction !== undefined) updateData.modeExtraction = donnees.modeExtraction;
      if (donnees.filtresMotsCles !== undefined) updateData.filtresMotsCles = donnees.filtresMotsCles;
      if (donnees.notifications !== undefined) updateData.notifications = donnees.notifications;
      if (donnees.plageHoraire !== undefined) updateData.plageHoraire = donnees.plageHoraire;

      if (Object.keys(updateData).length === 0) {
        return this.trouverParUtilisateurSource(utilisateurSourceId);
      }

      await db
        .update(parametresSources)
        .set(updateData)
        .where(eq(parametresSources.utilisateurSourceId, utilisateurSourceId));

      loggerBdd.info({ utilisateurSourceId }, 'Paramètres mis à jour');

      return this.trouverParUtilisateurSource(utilisateurSourceId);
    } catch (erreur) {
      loggerBdd.error({ erreur, utilisateurSourceId }, 'Erreur lors de la mise à jour paramètres');
      throw erreur;
    }
  }

  async reinitialiser(utilisateurSourceId: string): Promise<ParametresSource | null> {
    return this.mettreAJour(utilisateurSourceId, PARAMETRES_DEFAUT);
  }

  private versParametres(row: typeof parametresSources.$inferSelect): ParametresSource {
    return {
      id: row.id,
      utilisateurSourceId: row.utilisateurSourceId,
      nombreMaxArticles: row.nombreMaxArticles ?? 20,
      frequenceMinutes: row.frequenceMinutes ?? 30,
      retentionJours: row.retentionJours ?? 30,
      priorite: (row.priorite ?? 'normale') as ParametresSource['priorite'],
      modeExtraction: (row.modeExtraction ?? 'auto') as ParametresSource['modeExtraction'],
      filtresMotsCles: (row.filtresMotsCles as FiltresMotsCles) ?? {},
      notifications: (row.notifications ?? 'nouveaux') as ParametresSource['notifications'],
      plageHoraire: row.plageHoraire as PlageHoraire | null,
    };
  }
}
