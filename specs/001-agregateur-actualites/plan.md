# Plan d'Implémentation : Veilleur

**Projet** : **Veilleur** - Votre sentinelle de l'information
**Repository** : https://github.com/yrbane/veilleur
**Branche** : `001-agregateur-actualites` | **Date** : 2025-12-05 | **Spec** : [spec.md](./spec.md)

## Résumé

**Veilleur** est un agrégateur d'actualités libre permettant aux utilisateurs
d'ajouter leurs propres sources RSS/web, de les noter, taguer, et découvrir
des sources via la communauté. Le système inclut un cache agressif,
l'extraction des métadonnées sociales (Open Graph, Twitter Cards), et des
paramètres avancés par source.

## Contexte Technique

**Langage/Version** : TypeScript 5.7+ (Node.js 22 LTS)
**Dépendances Principales** :
- Backend : Fastify 5.x, Drizzle ORM 0.36+
- Frontend : Vanilla TypeScript, Vite 6.x
- Scraping : cheerio, rss-parser
- Cache : ioredis

**Stockage** : MariaDB 11.x + Redis 7.x
**Tests** : Vitest + Playwright
**Plateforme Cible** : Linux server (backend), navigateurs modernes (frontend)
**Type de Projet** : Application web (backend + frontend)
**Objectifs Performance** :
- p95 < 200ms pour les requêtes API
- 1000 utilisateurs simultanés
- 90% des requêtes servies depuis le cache

**Contraintes** :
- Cache partagé entre utilisateurs (1 requête/source/intervalle)
- Respect des robots.txt
- Rate limiting côté client

**Échelle** : 1000+ utilisateurs, 100 sources/utilisateur max

## Vérification Constitution

*PORTE : Doit passer avant la Phase 0. Revérifier après la Phase 1.*

| Principe | Statut | Conformité |
|----------|--------|------------|
| I. TDD First | ✅ | Tests Vitest écrits avant implémentation |
| II. Security by Design | ✅ | Validation entrées, auth JWT, HTTPS, sanitization |
| III. Performance First | ✅ | Cache Redis, requêtes optimisées, lazy loading |
| IV. SOLID Code | ✅ | Architecture en couches, injection dépendances |
| V. Ergonomie | ✅ | UI intuitive, messages clairs, responsive |
| VI. Langue Française | ✅ | Code, variables, commentaires en français |
| VII. Harmonie Esthétique | ✅ | CSS moderne, design system cohérent |

## Structure du Projet

### Documentation (cette fonctionnalité)

```text
specs/001-agregateur-actualites/
├── plan.md              # Ce fichier
├── spec.md              # Spécification fonctionnelle
├── research.md          # Recherche Phase 0
├── data-model.md        # Modèle de données Phase 1
├── quickstart.md        # Guide de démarrage Phase 1
├── contracts/           # Contrats API Phase 1
│   └── api.yaml         # Spécification OpenAPI
└── tasks.md             # Tâches (créé par /speckit.tasks)
```

### Code Source (racine du dépôt)

```text
src/
├── domaine/
│   ├── entites/
│   │   ├── Utilisateur.ts
│   │   ├── Source.ts
│   │   ├── Article.ts
│   │   ├── ParametresSource.ts
│   │   ├── Tag.ts
│   │   └── Notation.ts
│   └── services/
│       ├── ServiceAuthentification.ts
│       ├── ServiceSources.ts
│       ├── ServiceArticles.ts
│       ├── ServiceCache.ts
│       ├── ServiceScraping.ts
│       └── ServiceCommunaute.ts
│
├── infrastructure/
│   ├── bdd/
│   │   ├── schema.ts
│   │   ├── migrations/
│   │   └── ClientMariaDB.ts
│   ├── cache/
│   │   └── ClientRedis.ts
│   ├── scraping/
│   │   ├── ExtracteurRss.ts
│   │   ├── ExtracteurHtml.ts
│   │   └── ExtracteurMetadonnees.ts
│   └── http/
│       └── ClientHttp.ts
│
├── api/
│   ├── routes/
│   │   ├── authentification.ts
│   │   ├── sources.ts
│   │   ├── articles.ts
│   │   ├── tags.ts
│   │   └── communaute.ts
│   ├── middlewares/
│   │   ├── authentification.ts
│   │   ├── validation.ts
│   │   └── rateLimiting.ts
│   └── serveur.ts
│
└── client/
    ├── index.html
    ├── main.ts
    ├── styles/
    │   ├── base.css
    │   ├── composants.css
    │   ├── pages.css
    │   └── themes.css
    ├── composants/
    │   ├── CarteArticle.ts
    │   ├── ListeSources.ts
    │   ├── FilActualites.ts
    │   ├── FormulaireSource.ts
    │   ├── PanneauParametres.ts
    │   └── NavigationPrincipale.ts
    ├── pages/
    │   ├── Accueil.ts
    │   ├── MesSources.ts
    │   ├── Decouverte.ts
    │   ├── Parametres.ts
    │   └── Connexion.ts
    └── services/
        ├── ClientApi.ts
        ├── GestionnaireTheme.ts
        └── GestionnaireEtat.ts

tests/
├── unitaires/
│   ├── domaine/
│   └── infrastructure/
├── integration/
│   └── api/
└── e2e/
    └── scenarios/

drizzle.config.ts
vite.config.ts
vitest.config.ts
playwright.config.ts
tsconfig.json
package.json
```

**Décision de Structure** : Architecture en couches (domaine/infrastructure/api/client)
suivant les principes SOLID et permettant une séparation claire des responsabilités.
Le frontend vanilla TypeScript est servi par Vite en développement et construit
en statique pour la production.

## Suivi de Complexité

> Aucune violation de la constitution identifiée.

| Violation | Justification | Alternative Rejetée |
|-----------|---------------|---------------------|
| - | - | - |
