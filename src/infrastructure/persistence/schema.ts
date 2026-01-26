/**
 * Veilleur - Schéma Drizzle ORM
 * Définition des tables MariaDB
 */

import {
  mysqlTable,
  varchar,
  timestamp,
  boolean,
  json,
  int,
  text,
  char,
  tinyint,
  mysqlEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// =============================================================================
// Types JSON
// =============================================================================

export interface Preferences {
  langue?: string;
  theme?: 'clair' | 'sombre' | 'auto';
  frequenceRafraichissement?: number;
}

export interface MetaOpenGraph {
  titre?: string;
  description?: string;
  image?: string;
  type?: string;
  url?: string;
  siteName?: string;
}

export interface MetaTwitter {
  titre?: string;
  description?: string;
  image?: string;
  card?: string;
  site?: string;
}

export interface FiltresMotsCles {
  inclure?: string[];
  exclure?: string[];
}

export interface PlageHoraire {
  debut?: string;
  fin?: string;
  joursActifs?: number[];
}

// =============================================================================
// Tables
// =============================================================================

/**
 * Table des utilisateurs
 */
export const utilisateurs = mysqlTable(
  'utilisateurs',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => createId()),
    email: varchar('email', { length: 255 }).notNull().unique(),
    motDePasseHash: varchar('mot_de_passe_hash', { length: 255 }).notNull(),
    dateCreation: timestamp('date_creation').notNull().defaultNow(),
    dateDerniereConnexion: timestamp('date_derniere_connexion'),
    preferences: json('preferences').$type<Preferences>().default({}),
    estActif: boolean('est_actif').default(true),
    // Champs 2FA TOTP
    totpSecret: varchar('totp_secret', { length: 64 }),
    totpActif: boolean('totp_actif').default(false),
  },
  table => ({
    idxEmail: index('idx_utilisateur_email').on(table.email),
  }),
);

/**
 * Table des refresh tokens
 */
export const refreshTokens = mysqlTable(
  'refresh_tokens',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => createId()),
    utilisateurId: varchar('utilisateur_id', { length: 36 }).notNull(),
    token: char('token', { length: 64 }).notNull().unique(),
    dateCreation: timestamp('date_creation').notNull().defaultNow(),
    dateExpiration: timestamp('date_expiration').notNull(),
    estRevoque: boolean('est_revoque').default(false),
  },
  table => ({
    idxToken: index('idx_refresh_token').on(table.token),
    idxUtilisateur: index('idx_refresh_utilisateur').on(table.utilisateurId),
    // Index pour nettoyage tokens expirés
    idxExpiration: index('idx_refresh_expiration').on(table.dateExpiration),
    // Index composite pour recherche tokens valides d'un utilisateur
    idxUtilisateurRevoque: index('idx_refresh_utilisateur_revoque').on(
      table.utilisateurId,
      table.estRevoque,
    ),
  }),
);

/**
 * Table des sources
 */
export const sources = mysqlTable(
  'sources',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => createId()),
    url: varchar('url', { length: 2048 }).notNull(),
    nom: varchar('nom', { length: 255 }).notNull(),
    typeSource: mysqlEnum('type_source', ['rss', 'atom', 'html']).notNull(),
    statut: mysqlEnum('statut', ['active', 'inactive', 'erreur']).default('active'),
    urlFavicon: varchar('url_favicon', { length: 2048 }),
    dateCreation: timestamp('date_creation').notNull().defaultNow(),
    dateDerniereSynchro: timestamp('date_derniere_synchro'),
    hashUrlNormalise: char('hash_url_normalise', { length: 32 }).unique(),
    nombreEchecs: int('nombre_echecs').default(0),
  },
  table => ({
    idxHash: index('idx_source_hash').on(table.hashUrlNormalise),
    idxStatut: index('idx_source_statut').on(table.statut),
    // Index pour synchronisation (sources actives à synchroniser)
    idxSynchro: index('idx_source_synchro').on(table.dateDerniereSynchro),
    // Index composite pour filtrage sources actives par date de synchro
    idxStatutSynchro: index('idx_source_statut_synchro').on(
      table.statut,
      table.dateDerniereSynchro,
    ),
  }),
);

/**
 * Table des articles
 */
export const articles = mysqlTable(
  'articles',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => createId()),
    sourceId: varchar('source_id', { length: 36 }).notNull(),
    titre: varchar('titre', { length: 512 }).notNull(),
    lien: varchar('lien', { length: 2048 }).notNull(),
    datePublication: timestamp('date_publication').notNull(),
    resume: text('resume'),
    urlImage: varchar('url_image', { length: 2048 }),
    auteur: varchar('auteur', { length: 255 }),
    metaOpenGraph: json('meta_open_graph').$type<MetaOpenGraph>().default({}),
    metaTwitter: json('meta_twitter').$type<MetaTwitter>().default({}),
    hashContenu: char('hash_contenu', { length: 32 }).unique(),
    dateExtraction: timestamp('date_extraction').notNull().defaultNow(),
  },
  table => ({
    idxSourceDate: index('idx_article_source_date').on(table.sourceId, table.datePublication),
    idxHash: index('idx_article_hash').on(table.hashContenu),
    idxDate: index('idx_article_date').on(table.datePublication),
    // Index sur sourceId seul pour suppression/comptage par source
    idxSource: index('idx_article_source').on(table.sourceId),
    // Index sur lien pour vérification d'existence (préfixe de 255 car longueur max index)
    idxLien: index('idx_article_lien').on(table.lien),
    // Index sur dateExtraction pour nettoyage
    idxExtraction: index('idx_article_extraction').on(table.dateExtraction),
  }),
);

/**
 * Table de liaison utilisateur-source
 */
export const utilisateursSources = mysqlTable(
  'utilisateurs_sources',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => createId()),
    utilisateurId: varchar('utilisateur_id', { length: 36 }).notNull(),
    sourceId: varchar('source_id', { length: 36 }).notNull(),
    dateAjout: timestamp('date_ajout').notNull().defaultNow(),
    note: tinyint('note'),
    estEnPause: boolean('est_en_pause').default(false),
  },
  table => ({
    idxUnique: uniqueIndex('idx_utilisateur_source_unique').on(
      table.utilisateurId,
      table.sourceId,
    ),
    idxUtilisateur: index('idx_utilisateur_source_utilisateur').on(table.utilisateurId),
    // Index sur sourceId pour compter/supprimer sources orphelines
    idxSource: index('idx_utilisateur_source_source').on(table.sourceId),
    // Index composite pour fil d'actualités (sources non en pause)
    idxUtilisateurPause: index('idx_utilisateur_source_pause').on(
      table.utilisateurId,
      table.estEnPause,
    ),
    // Index pour tri par date d'ajout
    idxDateAjout: index('idx_utilisateur_source_date').on(table.dateAjout),
  }),
);

/**
 * Table des paramètres par source
 */
export const parametresSources = mysqlTable(
  'parametres_sources',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => createId()),
    utilisateurSourceId: varchar('utilisateur_source_id', { length: 36 }).notNull().unique(),
    nombreMaxArticles: int('nombre_max_articles').default(20),
    frequenceMinutes: int('frequence_minutes').default(30),
    retentionJours: int('retention_jours').default(30),
    priorite: mysqlEnum('priorite', ['haute', 'normale', 'basse']).default('normale'),
    modeExtraction: mysqlEnum('mode_extraction', ['rss', 'scraping', 'auto']).default('auto'),
    filtresMotsCles: json('filtres_mots_cles').$type<FiltresMotsCles>().default({}),
    notifications: mysqlEnum('notifications', ['aucune', 'nouveaux', 'tous']).default('nouveaux'),
    plageHoraire: json('plage_horaire').$type<PlageHoraire>(),
  },
  table => ({
    // Index sur priorité pour ordonnancer les synchronisations
    idxPriorite: index('idx_parametres_priorite').on(table.priorite),
  }),
);

/**
 * Table des tags
 */
export const tags = mysqlTable(
  'tags',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => createId()),
    nom: varchar('nom', { length: 50 }).notNull(),
    slug: varchar('slug', { length: 50 }).notNull().unique(),
    dateCreation: timestamp('date_creation').notNull().defaultNow(),
  },
  table => ({
    idxSlug: index('idx_tag_slug').on(table.slug),
    idxNom: index('idx_tag_nom').on(table.nom),
  }),
);

/**
 * Table de liaison utilisateur-source-tag
 */
export const utilisateursSourcesTags = mysqlTable(
  'utilisateurs_sources_tags',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => createId()),
    utilisateurSourceId: varchar('utilisateur_source_id', { length: 36 }).notNull(),
    tagId: varchar('tag_id', { length: 36 }).notNull(),
    dateCreation: timestamp('date_creation').notNull().defaultNow(),
  },
  table => ({
    idxUnique: uniqueIndex('idx_ust_unique').on(table.utilisateurSourceId, table.tagId),
    idxTag: index('idx_ust_tag').on(table.tagId),
  }),
);

/**
 * Table de cache source (fallback si Redis indisponible)
 */
export const cachesSources = mysqlTable(
  'caches_sources',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => createId()),
    sourceId: varchar('source_id', { length: 36 }).notNull().unique(),
    donneesJson: text('donnees_json').notNull(),
    dateCreation: timestamp('date_creation').notNull().defaultNow(),
    dateExpiration: timestamp('date_expiration').notNull(),
  },
  table => ({
    // Index pour nettoyage des entrées expirées
    idxExpiration: index('idx_cache_expiration').on(table.dateExpiration),
  }),
);

// =============================================================================
// Relations
// =============================================================================

export const utilisateursRelations = relations(utilisateurs, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  utilisateursSources: many(utilisateursSources),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  utilisateur: one(utilisateurs, {
    fields: [refreshTokens.utilisateurId],
    references: [utilisateurs.id],
  }),
}));

export const sourcesRelations = relations(sources, ({ many }) => ({
  articles: many(articles),
  utilisateursSources: many(utilisateursSources),
  cache: many(cachesSources),
}));

export const articlesRelations = relations(articles, ({ one }) => ({
  source: one(sources, {
    fields: [articles.sourceId],
    references: [sources.id],
  }),
}));

export const utilisateursSourcesRelations = relations(utilisateursSources, ({ one, many }) => ({
  utilisateur: one(utilisateurs, {
    fields: [utilisateursSources.utilisateurId],
    references: [utilisateurs.id],
  }),
  source: one(sources, {
    fields: [utilisateursSources.sourceId],
    references: [sources.id],
  }),
  parametres: one(parametresSources, {
    fields: [utilisateursSources.id],
    references: [parametresSources.utilisateurSourceId],
  }),
  tags: many(utilisateursSourcesTags),
}));

export const parametresSourcesRelations = relations(parametresSources, ({ one }) => ({
  utilisateurSource: one(utilisateursSources, {
    fields: [parametresSources.utilisateurSourceId],
    references: [utilisateursSources.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  utilisateursSources: many(utilisateursSourcesTags),
}));

export const utilisateursSourcesTagsRelations = relations(utilisateursSourcesTags, ({ one }) => ({
  utilisateurSource: one(utilisateursSources, {
    fields: [utilisateursSourcesTags.utilisateurSourceId],
    references: [utilisateursSources.id],
  }),
  tag: one(tags, {
    fields: [utilisateursSourcesTags.tagId],
    references: [tags.id],
  }),
}));

export const cachesSourcesRelations = relations(cachesSources, ({ one }) => ({
  source: one(sources, {
    fields: [cachesSources.sourceId],
    references: [sources.id],
  }),
}));
