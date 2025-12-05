# Modèle de Données : Agrégateur d'Actualités Libre

**Date** : 2025-12-05
**Branche** : `001-agregateur-actualites`

## Diagramme Entités-Relations

```
┌─────────────────┐       ┌──────────────────────┐
│   Utilisateur   │       │        Source        │
├─────────────────┤       ├──────────────────────┤
│ id              │       │ id                   │
│ email           │       │ url                  │
│ motDePasseHash  │       │ nom                  │
│ dateCreation    │       │ typeSource           │
│ dateDerniereConnexion   │ statut               │
│ preferences     │       │ urlFavicon           │
│ estActif        │       │ dateCreation         │
└────────┬────────┘       │ dateDerniereSynchro  │
         │                │ hashUrlNormalise     │
         │                └──────────┬───────────┘
         │                           │
         │    ┌──────────────────────┼──────────────────────┐
         │    │                      │                      │
         ▼    ▼                      ▼                      ▼
┌─────────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ UtilisateurSource   │    │     Article     │    │  CacheSource    │
├─────────────────────┤    ├─────────────────┤    ├─────────────────┤
│ id                  │    │ id              │    │ id              │
│ utilisateurId       │◄───│ sourceId        │    │ sourceId        │
│ sourceId            │    │ titre           │    │ donneesJson     │
│ dateAjout           │    │ lien            │    │ dateCreation    │
│ note (1-5)          │    │ datePublication │    │ dateExpiration  │
│ estEnPause          │    │ resume          │    └─────────────────┘
└─────────┬───────────┘    │ urlImage        │
          │                │ auteur          │
          │                │ metaOpenGraph   │
          │                │ metaTwitter     │
          │                │ hashContenu     │
          │                │ dateExtraction  │
          ▼                └─────────────────┘
┌─────────────────────┐
│  ParametresSource   │
├─────────────────────┤              ┌─────────────────┐
│ id                  │              │       Tag       │
│ utilisateurSourceId │              ├─────────────────┤
│ nombreMaxArticles   │              │ id              │
│ frequenceMinutes    │              │ nom             │
│ retentionJours      │              │ slug            │
│ priorite            │              │ dateCreation    │
│ modeExtraction      │              └────────┬────────┘
│ filtresMotsCles     │                       │
│ notifications       │                       ▼
│ plageHoraire        │              ┌─────────────────────┐
└─────────────────────┘              │ UtilisateurSourceTag│
                                     ├─────────────────────┤
                                     │ id                  │
                                     │ utilisateurSourceId │
                                     │ tagId               │
                                     │ dateCreation        │
                                     └─────────────────────┘
```

## Entités Détaillées

### Utilisateur

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Adresse email |
| `motDePasseHash` | VARCHAR(255) | NOT NULL | Hash bcrypt du mot de passe |
| `dateCreation` | TIMESTAMP | NOT NULL, DEFAULT NOW | Date d'inscription |
| `dateDerniereConnexion` | TIMESTAMP | NULL | Dernière connexion |
| `preferences` | JSON | DEFAULT '{}' | Préférences utilisateur |
| `estActif` | BOOLEAN | DEFAULT TRUE | Compte actif ou désactivé |

**Index** :
- `idx_utilisateur_email` sur `email`

**Validations** :
- Email : format valide, max 255 caractères
- Mot de passe : min 8 caractères, 1 majuscule, 1 chiffre

---

### Source

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `url` | VARCHAR(2048) | NOT NULL | URL de la source |
| `nom` | VARCHAR(255) | NOT NULL | Nom affiché |
| `typeSource` | ENUM | NOT NULL | 'rss', 'atom', 'html' |
| `statut` | ENUM | DEFAULT 'active' | 'active', 'inactive', 'erreur' |
| `urlFavicon` | VARCHAR(2048) | NULL | URL du favicon |
| `dateCreation` | TIMESTAMP | NOT NULL | Date d'ajout |
| `dateDerniereSynchro` | TIMESTAMP | NULL | Dernière synchro réussie |
| `hashUrlNormalise` | CHAR(32) | UNIQUE | Hash MD5 URL normalisée |
| `nombreEchecs` | INT | DEFAULT 0 | Compteur d'échecs consécutifs |

**Index** :
- `idx_source_hash` sur `hashUrlNormalise`
- `idx_source_statut` sur `statut`

**États et Transitions** :
```
active ──[3 échecs]──► erreur
erreur ──[succès]────► active
active ──[suppression]► (deleted)
```

---

### Article

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `sourceId` | UUID | FK → Source | Source de l'article |
| `titre` | VARCHAR(512) | NOT NULL | Titre de l'article |
| `lien` | VARCHAR(2048) | NOT NULL | URL originale |
| `datePublication` | TIMESTAMP | NOT NULL | Date de publication |
| `resume` | TEXT | NULL | Résumé (max 500 car.) |
| `urlImage` | VARCHAR(2048) | NULL | Image principale |
| `auteur` | VARCHAR(255) | NULL | Auteur si disponible |
| `metaOpenGraph` | JSON | DEFAULT '{}' | Métadonnées OG |
| `metaTwitter` | JSON | DEFAULT '{}' | Métadonnées Twitter |
| `hashContenu` | CHAR(32) | UNIQUE | Hash pour déduplication |
| `dateExtraction` | TIMESTAMP | NOT NULL | Date d'extraction |

**Index** :
- `idx_article_source_date` sur `(sourceId, datePublication DESC)`
- `idx_article_hash` sur `hashContenu`
- `idx_article_date` sur `datePublication DESC`

**JSON metaOpenGraph** :
```json
{
  "titre": "string",
  "description": "string",
  "image": "string",
  "type": "string",
  "url": "string",
  "siteName": "string"
}
```

**JSON metaTwitter** :
```json
{
  "titre": "string",
  "description": "string",
  "image": "string",
  "card": "string",
  "site": "string"
}
```

---

### UtilisateurSource

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `utilisateurId` | UUID | FK → Utilisateur | Propriétaire |
| `sourceId` | UUID | FK → Source | Source suivie |
| `dateAjout` | TIMESTAMP | NOT NULL | Date d'abonnement |
| `note` | TINYINT | NULL, CHECK 1-5 | Note 1 à 5 étoiles |
| `estEnPause` | BOOLEAN | DEFAULT FALSE | Source en pause |

**Index** :
- `idx_utilisateur_source_unique` UNIQUE sur `(utilisateurId, sourceId)`
- `idx_utilisateur_source_utilisateur` sur `utilisateurId`

---

### ParametresSource

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `utilisateurSourceId` | UUID | FK → UtilisateurSource, UNIQUE | Relation 1:1 |
| `nombreMaxArticles` | INT | DEFAULT 20, CHECK 1-100 | Max articles affichés |
| `frequenceMinutes` | INT | DEFAULT 30, CHECK 5-1440 | Intervalle rafraîchissement |
| `retentionJours` | INT | DEFAULT 30, CHECK 1-365 | Durée rétention |
| `priorite` | ENUM | DEFAULT 'normale' | 'haute', 'normale', 'basse' |
| `modeExtraction` | ENUM | DEFAULT 'auto' | 'rss', 'scraping', 'auto' |
| `filtresMotsCles` | JSON | DEFAULT '{}' | Filtres inclusion/exclusion |
| `notifications` | ENUM | DEFAULT 'nouveaux' | 'aucune', 'nouveaux', 'tous' |
| `plageHoraire` | JSON | NULL | Plage horaire de récupération |

**JSON filtresMotsCles** :
```json
{
  "inclure": ["mot1", "mot2"],
  "exclure": ["spam", "pub"]
}
```

**JSON plageHoraire** :
```json
{
  "debut": "08:00",
  "fin": "22:00",
  "joursActifs": [1, 2, 3, 4, 5]  // Lundi à Vendredi
}
```

---

### Tag

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `nom` | VARCHAR(50) | NOT NULL | Nom du tag |
| `slug` | VARCHAR(50) | UNIQUE, NOT NULL | Slug URL-safe |
| `dateCreation` | TIMESTAMP | NOT NULL | Date de création |

**Index** :
- `idx_tag_slug` sur `slug`
- `idx_tag_nom` sur `nom`

---

### UtilisateurSourceTag

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `utilisateurSourceId` | UUID | FK → UtilisateurSource | Abonnement |
| `tagId` | UUID | FK → Tag | Tag associé |
| `dateCreation` | TIMESTAMP | NOT NULL | Date d'association |

**Index** :
- `idx_ust_unique` UNIQUE sur `(utilisateurSourceId, tagId)`
- `idx_ust_tag` sur `tagId`

---

### CacheSource

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `sourceId` | UUID | FK → Source, UNIQUE | Source cachée |
| `donneesJson` | LONGTEXT | NOT NULL | Articles sérialisés |
| `dateCreation` | TIMESTAMP | NOT NULL | Date mise en cache |
| `dateExpiration` | TIMESTAMP | NOT NULL | Expiration cache |

**Note** : Table de secours si Redis indisponible. En fonctionnement normal,
le cache est géré par Redis.

---

### RefreshToken

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK | Identifiant unique |
| `utilisateurId` | UUID | FK → Utilisateur | Propriétaire |
| `token` | CHAR(64) | UNIQUE, NOT NULL | Token hashé |
| `dateCreation` | TIMESTAMP | NOT NULL | Date de création |
| `dateExpiration` | TIMESTAMP | NOT NULL | Date d'expiration |
| `estRevoque` | BOOLEAN | DEFAULT FALSE | Token révoqué |

**Index** :
- `idx_refresh_token` sur `token`
- `idx_refresh_utilisateur` sur `utilisateurId`

---

## Requêtes Fréquentes

### Fil d'actualités utilisateur
```sql
SELECT a.*, s.nom AS nomSource, s.urlFavicon
FROM Article a
JOIN Source s ON a.sourceId = s.id
JOIN UtilisateurSource us ON us.sourceId = s.id
LEFT JOIN ParametresSource ps ON ps.utilisateurSourceId = us.id
WHERE us.utilisateurId = :userId
  AND us.estEnPause = FALSE
  AND a.datePublication >= DATE_SUB(NOW(), INTERVAL COALESCE(ps.retentionJours, 30) DAY)
ORDER BY
  CASE COALESCE(ps.priorite, 'normale')
    WHEN 'haute' THEN 1
    WHEN 'normale' THEN 2
    WHEN 'basse' THEN 3
  END,
  a.datePublication DESC
LIMIT :limit OFFSET :offset;
```

### Sources populaires communauté
```sql
SELECT
  s.*,
  COUNT(DISTINCT us.utilisateurId) AS nombreAbonnes,
  AVG(us.note) AS noteMoyenne,
  GROUP_CONCAT(DISTINCT t.nom) AS tags
FROM Source s
JOIN UtilisateurSource us ON us.sourceId = s.id
LEFT JOIN UtilisateurSourceTag ust ON ust.utilisateurSourceId = us.id
LEFT JOIN Tag t ON t.id = ust.tagId
WHERE s.statut = 'active'
GROUP BY s.id
HAVING nombreAbonnes >= 3
ORDER BY noteMoyenne DESC, nombreAbonnes DESC
LIMIT 50;
```

### Filtrage par tag
```sql
SELECT DISTINCT s.*
FROM Source s
JOIN UtilisateurSource us ON us.sourceId = s.id
JOIN UtilisateurSourceTag ust ON ust.utilisateurSourceId = us.id
JOIN Tag t ON t.id = ust.tagId
WHERE t.slug = :tagSlug
GROUP BY s.id
HAVING COUNT(DISTINCT us.utilisateurId) >= 3;
```

---

## Schéma Drizzle (aperçu)

```typescript
// src/infrastructure/bdd/schema.ts

import { mysqlTable, varchar, timestamp, boolean, json, int, mysqlEnum, char } from 'drizzle-orm/mysql-core';
import { createId } from '@paralleldrive/cuid2';

export const utilisateurs = mysqlTable('utilisateurs', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => createId()),
  email: varchar('email', { length: 255 }).notNull().unique(),
  motDePasseHash: varchar('mot_de_passe_hash', { length: 255 }).notNull(),
  dateCreation: timestamp('date_creation').notNull().defaultNow(),
  dateDerniereConnexion: timestamp('date_derniere_connexion'),
  preferences: json('preferences').$type<Preferences>().default({}),
  estActif: boolean('est_actif').default(true),
});

export const sources = mysqlTable('sources', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => createId()),
  url: varchar('url', { length: 2048 }).notNull(),
  nom: varchar('nom', { length: 255 }).notNull(),
  typeSource: mysqlEnum('type_source', ['rss', 'atom', 'html']).notNull(),
  statut: mysqlEnum('statut', ['active', 'inactive', 'erreur']).default('active'),
  urlFavicon: varchar('url_favicon', { length: 2048 }),
  dateCreation: timestamp('date_creation').notNull().defaultNow(),
  dateDerniereSynchro: timestamp('date_derniere_synchro'),
  hashUrlNormalise: char('hash_url_normalise', { length: 32 }).unique(),
  nombreEchecs: int('nombre_echecs').default(0),
});

// ... autres tables
```

---

## Migrations

### Migration Initiale (001)
1. Créer toutes les tables
2. Créer les index
3. Insérer données de référence (si nécessaire)

### Commandes
```bash
# Générer migration
npm run db:generate

# Appliquer migrations
npm run db:migrate

# Visualiser schéma
npm run db:studio
```
