# Tâches : Agrégateur d'Actualités Libre

**Entrée** : Documents de design depuis `/specs/001-agregateur-actualites/`
**Prérequis** : plan.md, spec.md, research.md, data-model.md, contracts/

**Tests** : Inclus (Constitution TDD First - tests écrits avant implémentation)

**Organisation** : Tâches groupées par user story pour permettre une implémentation
et des tests indépendants de chaque story.

## Format : `[ID] [P?] [Story] Description`

- **[P]** : Peut s'exécuter en parallèle (fichiers différents, pas de dépendances)
- **[Story]** : User story concernée (US1, US2, US3, US4, US5, US6)
- Chemins exacts inclus dans les descriptions

## Conventions de Chemins

Structure web app selon plan.md :
- Backend : `src/domaine/`, `src/infrastructure/`, `src/api/`
- Frontend : `src/client/`
- Tests : `tests/unitaires/`, `tests/integration/`, `tests/e2e/`

---

## Phase 1 : Setup (Infrastructure Partagée)

**Objectif** : Initialisation du projet et structure de base

- [x] T001 Créer la structure de dossiers selon le plan d'implémentation
- [x] T002 Initialiser le projet Node.js avec package.json et dépendances (fastify, drizzle-orm, ioredis, cheerio, rss-parser, vitest, playwright)
- [x] T003 [P] Configurer TypeScript avec tsconfig.json
- [x] T004 [P] Configurer ESLint et Prettier pour le formatage en français
- [x] T005 [P] Configurer Vitest avec vitest.config.ts
- [x] T006 [P] Configurer Playwright avec playwright.config.ts
- [x] T007 [P] Configurer Vite pour le frontend avec vite.config.ts
- [x] T008 Créer le fichier .env.example avec toutes les variables d'environnement
- [x] T009 [P] Configurer Drizzle avec drizzle.config.ts pour MariaDB

---

## Phase 2 : Fondations (Prérequis Bloquants)

**Objectif** : Infrastructure de base nécessaire AVANT toute user story

**⚠️ CRITIQUE** : Aucune user story ne peut commencer avant la fin de cette phase

### Tests Fondations

- [ ] T010 [P] Test unitaire pour ClientMariaDB dans tests/unitaires/infrastructure/ClientMariaDB.test.ts
- [ ] T011 [P] Test unitaire pour ClientRedis dans tests/unitaires/infrastructure/ClientRedis.test.ts
- [ ] T012 [P] Test unitaire pour middleware authentification dans tests/unitaires/api/middlewareAuth.test.ts

### Implémentation Fondations

- [ ] T013 Créer le schéma Drizzle complet dans src/infrastructure/bdd/schema.ts
- [ ] T014 Générer et appliquer la migration initiale dans src/infrastructure/bdd/migrations/
- [ ] T015 [P] Implémenter ClientMariaDB dans src/infrastructure/bdd/ClientMariaDB.ts
- [ ] T016 [P] Implémenter ClientRedis dans src/infrastructure/cache/ClientRedis.ts
- [ ] T017 [P] Implémenter ClientHttp avec rate limiting dans src/infrastructure/http/ClientHttp.ts
- [ ] T018 Créer l'entité Utilisateur dans src/domaine/entites/Utilisateur.ts
- [ ] T019 Implémenter ServiceAuthentification (JWT, refresh tokens) dans src/domaine/services/ServiceAuthentification.ts
- [ ] T020 [P] Implémenter middleware authentification dans src/api/middlewares/authentification.ts
- [ ] T021 [P] Implémenter middleware validation dans src/api/middlewares/validation.ts
- [ ] T022 [P] Implémenter middleware rateLimiting dans src/api/middlewares/rateLimiting.ts
- [ ] T023 Configurer le serveur Fastify dans src/api/serveur.ts
- [ ] T024 Implémenter routes authentification (inscription, connexion, rafraîchir, déconnexion, profil) dans src/api/routes/authentification.ts
- [ ] T025 [P] Créer les styles CSS de base dans src/client/styles/base.css
- [ ] T026 [P] Créer les thèmes CSS (clair, sombre, sepia) dans src/client/styles/themes.css
- [ ] T027 [P] Implémenter GestionnaireTheme dans src/client/services/GestionnaireTheme.ts
- [ ] T028 [P] Implémenter GestionnaireEtat dans src/client/services/GestionnaireEtat.ts
- [ ] T029 [P] Implémenter ClientApi dans src/client/services/ClientApi.ts
- [ ] T030 Créer la page Connexion dans src/client/pages/Connexion.ts
- [ ] T031 Implémenter NavigationPrincipale dans src/client/composants/NavigationPrincipale.ts
- [ ] T032 Configurer le point d'entrée frontend dans src/client/main.ts et src/client/index.html

**Checkpoint** : Fondations prêtes - l'implémentation des user stories peut commencer

---

## Phase 3 : User Story 1 - Ajouter une source (Priorité : P1) 🎯 MVP

**Objectif** : L'utilisateur peut ajouter l'URL d'un site web ou flux RSS

**Test Indépendant** : L'utilisateur ajoute une URL, voit la source apparaître dans sa liste, et constate que les articles sont récupérés

### Tests US1

- [ ] T033 [P] [US1] Test unitaire ExtracteurRss dans tests/unitaires/infrastructure/ExtracteurRss.test.ts
- [ ] T034 [P] [US1] Test unitaire ExtracteurHtml dans tests/unitaires/infrastructure/ExtracteurHtml.test.ts
- [ ] T035 [P] [US1] Test unitaire ExtracteurMetadonnees dans tests/unitaires/infrastructure/ExtracteurMetadonnees.test.ts
- [ ] T036 [P] [US1] Test unitaire ServiceSources dans tests/unitaires/domaine/ServiceSources.test.ts
- [ ] T037 [P] [US1] Test unitaire ServiceCache dans tests/unitaires/domaine/ServiceCache.test.ts
- [ ] T038 [P] [US1] Test intégration route POST /sources dans tests/integration/api/sources.test.ts
- [ ] T039 [US1] Test E2E ajout source RSS dans tests/e2e/scenarios/ajouterSource.spec.ts

### Implémentation US1

- [ ] T040 [P] [US1] Créer l'entité Source dans src/domaine/entites/Source.ts
- [ ] T041 [P] [US1] Créer l'entité Article dans src/domaine/entites/Article.ts
- [ ] T042 [P] [US1] Implémenter ExtracteurRss dans src/infrastructure/scraping/ExtracteurRss.ts
- [ ] T043 [P] [US1] Implémenter ExtracteurHtml dans src/infrastructure/scraping/ExtracteurHtml.ts
- [ ] T044 [P] [US1] Implémenter ExtracteurMetadonnees (Open Graph, Twitter Cards) dans src/infrastructure/scraping/ExtracteurMetadonnees.ts
- [ ] T045 [US1] Implémenter ServiceCache (Redis) dans src/domaine/services/ServiceCache.ts
- [ ] T046 [US1] Implémenter ServiceScraping (orchestration extraction) dans src/domaine/services/ServiceScraping.ts
- [ ] T047 [US1] Implémenter ServiceSources dans src/domaine/services/ServiceSources.ts
- [ ] T048 [US1] Implémenter routes sources (GET, POST, DELETE) dans src/api/routes/sources.ts
- [ ] T049 [P] [US1] Créer styles composants dans src/client/styles/composants.css
- [ ] T050 [P] [US1] Implémenter FormulaireSource dans src/client/composants/FormulaireSource.ts
- [ ] T051 [P] [US1] Implémenter ListeSources dans src/client/composants/ListeSources.ts
- [ ] T052 [US1] Créer page MesSources dans src/client/pages/MesSources.ts

**Checkpoint** : US1 fonctionnelle - l'utilisateur peut ajouter et voir ses sources

---

## Phase 4 : User Story 2 - Consulter le fil d'actualités (Priorité : P1)

**Objectif** : L'utilisateur voit les actualités de toutes ses sources dans un fil unifié

**Test Indépendant** : L'utilisateur voit son fil avec articles formatés et peut cliquer pour être redirigé

### Tests US2

- [ ] T053 [P] [US2] Test unitaire ServiceArticles dans tests/unitaires/domaine/ServiceArticles.test.ts
- [ ] T054 [P] [US2] Test intégration route GET /articles dans tests/integration/api/articles.test.ts
- [ ] T055 [US2] Test E2E consultation fil dans tests/e2e/scenarios/consulterFil.spec.ts

### Implémentation US2

- [ ] T056 [US2] Implémenter ServiceArticles (fil unifié, tri, pagination) dans src/domaine/services/ServiceArticles.ts
- [ ] T057 [US2] Implémenter routes articles (GET liste, GET détail) dans src/api/routes/articles.ts
- [ ] T058 [P] [US2] Implémenter CarteArticle dans src/client/composants/CarteArticle.ts
- [ ] T059 [P] [US2] Implémenter FilActualites dans src/client/composants/FilActualites.ts
- [ ] T060 [US2] Créer page Accueil avec fil d'actualités dans src/client/pages/Accueil.ts
- [ ] T061 [US2] Créer styles pages dans src/client/styles/pages.css

**Checkpoint** : US2 fonctionnelle - MVP complet (ajouter sources + voir fil)

---

## Phase 5 : User Story 5 - Gérer son compte (Priorité : P2)

**Objectif** : L'utilisateur peut créer un compte, se connecter et gérer ses préférences

**Test Indépendant** : L'utilisateur s'inscrit, se connecte, et retrouve ses sources après reconnexion

### Tests US5

- [ ] T062 [P] [US5] Test intégration routes auth complètes dans tests/integration/api/authentification.test.ts
- [ ] T063 [US5] Test E2E parcours inscription/connexion dans tests/e2e/scenarios/gestionCompte.spec.ts

### Implémentation US5

- [ ] T064 [US5] Ajouter gestion préférences utilisateur dans src/domaine/services/ServiceAuthentification.ts
- [ ] T065 [US5] Implémenter route PATCH /auth/profil dans src/api/routes/authentification.ts
- [ ] T066 [US5] Créer page Parametres (profil utilisateur) dans src/client/pages/Parametres.ts

**Checkpoint** : US5 fonctionnelle - gestion compte complète

---

## Phase 6 : User Story 3 - Noter et taguer les sources (Priorité : P2)

**Objectif** : L'utilisateur peut noter ses sources et leur ajouter des tags personnalisés

**Test Indépendant** : L'utilisateur note une source de 1-5 étoiles et lui ajoute des tags

### Tests US3

- [ ] T067 [P] [US3] Test unitaire entité Tag dans tests/unitaires/domaine/Tag.test.ts
- [ ] T068 [P] [US3] Test intégration routes tags dans tests/integration/api/tags.test.ts
- [ ] T069 [P] [US3] Test intégration route PUT /sources/{id}/note dans tests/integration/api/notation.test.ts
- [ ] T070 [US3] Test E2E notation et tagging dans tests/e2e/scenarios/noterTaguer.spec.ts

### Implémentation US3

- [ ] T071 [P] [US3] Créer l'entité Tag dans src/domaine/entites/Tag.ts
- [ ] T072 [P] [US3] Créer l'entité Notation dans src/domaine/entites/Notation.ts
- [ ] T073 [US3] Ajouter méthodes notation/tags dans ServiceSources dans src/domaine/services/ServiceSources.ts
- [ ] T074 [US3] Implémenter routes tags (CRUD) dans src/api/routes/tags.ts
- [ ] T075 [US3] Ajouter routes notation et tags sur sources dans src/api/routes/sources.ts
- [ ] T076 [US3] Ajouter composant notation étoiles dans ListeSources dans src/client/composants/ListeSources.ts
- [ ] T077 [US3] Ajouter gestion tags dans page MesSources dans src/client/pages/MesSources.ts

**Checkpoint** : US3 fonctionnelle - notation et tags opérationnels

---

## Phase 7 : User Story 6 - Paramètres avancés par source (Priorité : P2)

**Objectif** : L'utilisateur peut ajuster finement le comportement de chaque source

**Test Indépendant** : L'utilisateur modifie les paramètres et constate les changements

### Tests US6

- [ ] T078 [P] [US6] Test unitaire entité ParametresSource dans tests/unitaires/domaine/ParametresSource.test.ts
- [ ] T079 [P] [US6] Test intégration routes parametres dans tests/integration/api/parametres.test.ts
- [ ] T080 [US6] Test E2E modification paramètres dans tests/e2e/scenarios/parametresSource.spec.ts

### Implémentation US6

- [ ] T081 [US6] Créer l'entité ParametresSource dans src/domaine/entites/ParametresSource.ts
- [ ] T082 [US6] Ajouter gestion paramètres dans ServiceSources dans src/domaine/services/ServiceSources.ts
- [ ] T083 [US6] Implémenter routes paramètres (GET, PATCH, DELETE) dans src/api/routes/sources.ts
- [ ] T084 [US6] Implémenter PanneauParametres dans src/client/composants/PanneauParametres.ts
- [ ] T085 [US6] Intégrer panneau paramètres dans page MesSources dans src/client/pages/MesSources.ts

**Checkpoint** : US6 fonctionnelle - paramètres avancés configurables

---

## Phase 8 : User Story 4 - Découvrir via la communauté (Priorité : P3)

**Objectif** : L'utilisateur peut voir les sources populaires et les filtrer par tags

**Test Indépendant** : L'utilisateur parcourt les sources publiques filtrées par tag avec notes moyennes

### Tests US4

- [ ] T086 [P] [US4] Test unitaire ServiceCommunaute dans tests/unitaires/domaine/ServiceCommunaute.test.ts
- [ ] T087 [P] [US4] Test intégration routes communauté dans tests/integration/api/communaute.test.ts
- [ ] T088 [US4] Test E2E découverte sources dans tests/e2e/scenarios/decouvrirSources.spec.ts

### Implémentation US4

- [ ] T089 [US4] Implémenter ServiceCommunaute (sources populaires, filtrage) dans src/domaine/services/ServiceCommunaute.ts
- [ ] T090 [US4] Implémenter routes communauté (sources populaires, tags populaires) dans src/api/routes/communaute.ts
- [ ] T091 [US4] Créer page Decouverte dans src/client/pages/Decouverte.ts
- [ ] T092 [US4] Ajouter composants liste sources communautaires dans src/client/composants/ListeSources.ts

**Checkpoint** : US4 fonctionnelle - découverte communautaire opérationnelle

---

## Phase 9 : Polish & Préoccupations Transversales

**Objectif** : Améliorations affectant plusieurs user stories

- [ ] T093 [P] Ajouter détection doublons (hash URL + similarité titre) dans ServiceArticles
- [ ] T094 [P] Implémenter jobs BullMQ pour rafraîchissement périodique des sources
- [ ] T095 [P] Ajouter gestion sources inaccessibles (marquage inactif après 3 échecs)
- [ ] T096 [P] Optimiser requêtes SQL avec index appropriés
- [ ] T097 [P] Ajouter logs structurés pour monitoring
- [ ] T098 Vérifier conformité WCAG 2.1 AA pour accessibilité
- [ ] T099 Valider performances (p95 < 200ms, 1000 utilisateurs)
- [ ] T100 Exécuter validation quickstart.md (démarrage complet)
- [ ] T101 Nettoyage code et refactoring final

---

## Dépendances & Ordre d'Exécution

### Dépendances de Phase

- **Setup (Phase 1)** : Aucune dépendance - peut démarrer immédiatement
- **Fondations (Phase 2)** : Dépend de Setup - BLOQUE toutes les user stories
- **User Stories (Phases 3-8)** : Toutes dépendent de la Phase 2
  - US1 et US2 sont P1 (MVP) - à faire en premier
  - US3, US5, US6 sont P2 - peuvent être parallélisées
  - US4 est P3 - après les P2
- **Polish (Phase 9)** : Dépend de toutes les user stories souhaitées

### Dépendances User Stories

| Story | Dépend de | Peut commencer après |
|-------|-----------|----------------------|
| US1 (Ajouter source) | Fondations | Phase 2 |
| US2 (Fil actualités) | US1 | Phase 3 |
| US5 (Compte) | Fondations | Phase 2 (parallèle à US1) |
| US3 (Noter/Taguer) | US1 | Phase 3 |
| US6 (Paramètres) | US1 | Phase 3 |
| US4 (Communauté) | US3 | Phase 6 |

### Opportunités Parallèles

- Toutes les tâches Setup [P] peuvent s'exécuter en parallèle
- Toutes les tâches Fondations [P] peuvent s'exécuter en parallèle
- Les tests [P] d'une user story peuvent s'exécuter en parallèle
- Les entités/modèles [P] peuvent s'exécuter en parallèle
- US5 peut être développée en parallèle avec US1

---

## Exemple Parallèle : User Story 1

```bash
# Lancer tous les tests US1 ensemble :
T033: Test ExtracteurRss
T034: Test ExtracteurHtml
T035: Test ExtracteurMetadonnees
T036: Test ServiceSources
T037: Test ServiceCache

# Lancer toutes les entités US1 ensemble :
T040: Entité Source
T041: Entité Article

# Lancer tous les extracteurs ensemble :
T042: ExtracteurRss
T043: ExtracteurHtml
T044: ExtracteurMetadonnees

# Lancer composants frontend ensemble :
T049: styles/composants.css
T050: FormulaireSource
T051: ListeSources
```

---

## Stratégie d'Implémentation

### MVP First (US1 + US2 uniquement)

1. Compléter Phase 1 : Setup
2. Compléter Phase 2 : Fondations (CRITIQUE - bloque tout)
3. Compléter Phase 3 : US1 (Ajouter source)
4. Compléter Phase 4 : US2 (Fil actualités)
5. **STOP et VALIDER** : Tester le MVP indépendamment
6. Déployer/démo si prêt

### Livraison Incrémentale

1. Setup + Fondations → Base prête
2. + US1 + US2 → MVP (ajouter sources, voir fil)
3. + US5 → Gestion compte
4. + US3 → Notation et tags
5. + US6 → Paramètres avancés
6. + US4 → Découverte communautaire
7. Chaque story ajoute de la valeur sans casser les précédentes

### Stratégie Équipe Parallèle

Avec plusieurs développeurs :

1. L'équipe complète Setup + Fondations ensemble
2. Une fois Fondations terminée :
   - Dev A : US1 puis US2 (MVP)
   - Dev B : US5 puis US3
   - Dev C : US6 puis US4
3. Les stories se complètent et s'intègrent indépendamment

---

## Notes

- Les tâches [P] = fichiers différents, pas de dépendances
- Le label [Story] lie la tâche à sa user story pour traçabilité
- Chaque user story doit être testable et complétable indépendamment
- Constitution TDD : vérifier que les tests échouent avant d'implémenter
- Committer après chaque tâche ou groupe logique
- S'arrêter à n'importe quel checkpoint pour valider la story
- Éviter : tâches vagues, conflits de fichiers, dépendances cross-story
