# Plan d'Implémentation : Veilleur

**Branche** : `001-agregateur-actualites` | **Date** : 2025-12-05 | **Spec** : [spec.md](./spec.md)
**Entrée** : Spécification de fonctionnalité depuis `/specs/001-agregateur-actualites/spec.md`

## Résumé

Agrégateur d'actualités libre permettant aux utilisateurs d'ajouter des sources RSS
et sites web, de consulter un fil unifié d'articles, de noter et taguer leurs sources,
et de découvrir des sources via la communauté. Architecture full-stack avec API
Fastify, frontend Vanilla TypeScript/Web Components, persistance MariaDB/Redis.

## Contexte Technique

**Langage/Version** : Node.js 22 LTS, TypeScript 5.7+
**Dépendances Principales** : Fastify 5.x, Drizzle ORM, BullMQ, cheerio, rss-parser
**Stockage** : MariaDB 11.x (données), Redis 7.x (cache, sessions, files d'attente)
**Tests** : Vitest (unitaires/intégration), Playwright (E2E)
**Plateforme Cible** : Docker (Linux containers), navigateurs modernes
**Type de Projet** : Web application (backend API + frontend SPA)
**Objectifs de Performance** : p95 < 500ms, p99 < 1s, 100 req/s, 1000 utilisateurs simultanés
**Contraintes** : Rate limiting 60 req/min (IP) / 300 req/min (user), cache 90% hit rate
**Échelle/Portée** : 1000 utilisateurs, 100 sources/utilisateur, ~10k articles en cache

## Vérification Constitution

*GATE : Doit passer avant Phase 0. Revérification après Phase 1.*

| Principe | Statut | Justification |
|----------|--------|---------------|
| I. TDD First | ✅ PASS | Tests écrits avant implémentation, Vitest + Playwright configurés |
| II. Security by Design | ✅ PASS | JWT + 2FA, validation Zod, rate limiting, bcrypt passwords |
| III. Performance First | ✅ PASS | Cibles définies (p95<500ms), cache Redis agressif, BullMQ async |
| IV. SOLID Code | ✅ PASS | Architecture hexagonale domaine/infrastructure/api |
| V. Usability | ✅ PASS | Messages français clairs, UX validée par stories |
| VI. Langue Française | ✅ PASS | Tout le code et docs en français |
| VII. Harmonie Esthétique | ✅ PASS | Formatage Prettier, CSS moderne, charte unifiée |

**Résultat** : ✅ Tous les gates passent - autorisation de procéder.

## Structure du Projet

### Documentation (cette fonctionnalité)

```text
specs/001-agregateur-actualites/
├── spec.md              # Spécification fonctionnelle
├── plan.md              # Ce fichier
├── research.md          # Phase 0 : recherche technique
├── data-model.md        # Phase 1 : modèle de données
├── quickstart.md        # Phase 1 : guide de démarrage
├── contracts/           # Phase 1 : contrats API
│   └── api.yaml         # OpenAPI 3.1
└── tasks.md             # Phase 2 : tâches (via /speckit.tasks)
```

### Code Source (racine du dépôt)

```text
src/
├── domaine/                    # Logique métier pure
│   ├── entites/                # Entités du domaine
│   │   ├── Utilisateur.ts
│   │   ├── Source.ts
│   │   ├── Article.ts
│   │   ├── Tag.ts
│   │   └── index.ts
│   ├── services/               # Services métier
│   │   ├── ServiceAuthentification.ts
│   │   ├── ServiceSources.ts
│   │   ├── ServiceArticles.ts
│   │   ├── ServiceTags.ts
│   │   └── ServiceDecouverte.ts
│   └── ports/                  # Interfaces (contrats)
│       ├── DepotUtilisateurs.ts
│       ├── DepotSources.ts
│       ├── DepotArticles.ts
│       └── ServiceCache.ts
│
├── infrastructure/             # Implémentations techniques
│   ├── persistence/            # Accès données
│   │   ├── schema.ts           # Schéma Drizzle
│   │   ├── DepotUtilisateursMariaDB.ts
│   │   ├── DepotSourcesMariaDB.ts
│   │   └── DepotArticlesMariaDB.ts
│   ├── cache/                  # Cache Redis
│   │   ├── ServiceCacheRedis.ts
│   │   └── gestionnaireSessions.ts
│   ├── scraping/               # Extraction articles
│   │   ├── extracteurRSS.ts
│   │   ├── extracteurHTML.ts
│   │   ├── extracteurMetadonnees.ts
│   │   └── detecteurFlux.ts
│   └── files/                  # Files d'attente BullMQ
│       ├── fileRafraichissement.ts
│       └── travailleurs/
│           └── travailleurScraping.ts
│
├── api/                        # Couche HTTP Fastify
│   ├── serveur.ts              # Point d'entrée
│   ├── routes/
│   │   ├── authentification.ts
│   │   ├── sources.ts
│   │   ├── articles.ts
│   │   ├── tags.ts
│   │   ├── decouverte.ts
│   │   └── sante.ts
│   ├── middlewares/
│   │   ├── authentification.ts
│   │   ├── rateLimiting.ts
│   │   └── validation.ts
│   └── schemas/                # Schémas Zod pour validation
│       ├── authentification.ts
│       ├── sources.ts
│       └── articles.ts
│
└── client/                     # Frontend Vanilla TS
    ├── index.html
    ├── styles/
    │   ├── variables.css
    │   ├── composants.css
    │   └── pages.css
    ├── composants/
    │   ├── CartArticle.ts
    │   ├── ListeSources.ts
    │   ├── FormulaireSource.ts
    │   └── Navigation.ts
    ├── pages/
    │   ├── PageAccueil.ts
    │   ├── PageFil.ts
    │   ├── PageSources.ts
    │   ├── PageDecouverte.ts
    │   └── PageConnexion.ts
    └── services/
        ├── clientApi.ts
        └── gestionnaireAuth.ts

tests/
├── unitaires/
│   ├── domaine/
│   └── infrastructure/
├── integration/
│   ├── api/
│   └── persistence/
└── e2e/
    ├── authentification.spec.ts
    ├── sources.spec.ts
    └── fil.spec.ts

drizzle/
└── migrations/                 # Migrations SQL générées
```

**Décision de Structure** : Architecture hexagonale (Ports & Adapters) avec séparation
claire domaine/infrastructure/api. Le frontend utilise des Web Components natifs
sans framework pour minimiser la complexité.

## Suivi de Complexité

> Aucune violation de constitution détectée - section non applicable.

## Phases d'Implémentation

### Phase 0 : Recherche (research.md)

Recherche technique sur :
- Meilleures pratiques JWT refresh tokens avec Fastify
- Stratégies de cache Redis pour articles
- Parsing RSS/Atom avec rss-parser
- Extraction métadonnées Open Graph avec cheerio
- Configuration BullMQ pour files de scraping
- Schéma Drizzle ORM pour MariaDB

### Phase 1 : Design (data-model.md, contracts/, quickstart.md)

1. Modèle de données complet avec relations
2. Contrat API OpenAPI 3.1
3. Guide de démarrage développeur

### Phase 2 : Tâches (tasks.md)

Décomposition en tâches atomiques via `/speckit.tasks`
