# Spécification de Fonctionnalité : Veilleur

**Nom du projet** : **Veilleur** - Votre sentinelle de l'information
**Repository** : https://github.com/yrbane/veilleur
**Branche** : `001-agregateur-actualites`
**Créée le** : 2025-12-05
**Statut** : Brouillon
**Description** : Agrégateur d'actualités libre avec scraping RSS et sites web

## Scénarios Utilisateur & Tests *(obligatoire)*

### Story 1 - Ajouter une source d'actualités (Priorité : P1)

En tant qu'utilisateur, je veux ajouter l'URL d'un site web ou d'un flux RSS pour
commencer à recevoir ses actualités dans mon fil personnalisé.

**Pourquoi cette priorité** : Sans sources, l'application n'a aucune valeur. C'est
la fonctionnalité fondatrice qui permet tout le reste.

**Test indépendant** : L'utilisateur peut ajouter une URL, voir la source apparaître
dans sa liste de sources, et constater que les articles sont récupérés.

**Scénarios d'acceptation** :

1. **Étant donné** un utilisateur connecté, **Quand** il saisit une URL de flux RSS
   valide et confirme, **Alors** la source est ajoutée et les articles apparaissent
   dans son fil en moins de 30 secondes.

2. **Étant donné** un utilisateur connecté, **Quand** il saisit l'URL d'un site web
   (non RSS), **Alors** le système détecte automatiquement le flux RSS associé ou
   extrait les articles par scraping.

3. **Étant donné** une URL invalide ou inaccessible, **Quand** l'utilisateur tente
   de l'ajouter, **Alors** un message d'erreur clair explique le problème.

---

### Story 2 - Consulter le fil d'actualités (Priorité : P1)

En tant qu'utilisateur, je veux voir les actualités de toutes mes sources dans un
fil unifié, avec pour chaque article : le titre, la date, un résumé, une image et
des tags.

**Pourquoi cette priorité** : C'est l'expérience principale de l'application, la
raison pour laquelle l'utilisateur vient.

**Test indépendant** : L'utilisateur voit son fil d'actualités avec les articles
formatés correctement et peut cliquer pour être redirigé vers l'article original.

**Scénarios d'acceptation** :

1. **Étant donné** un utilisateur avec des sources configurées, **Quand** il accède
   à son fil, **Alors** il voit les articles triés par date décroissante avec :
   titre, date de publication, mini résumé (max 200 caractères), image de
   couverture, tags.

2. **Étant donné** un article dans le fil, **Quand** l'utilisateur clique dessus,
   **Alors** il est redirigé vers le site source dans un nouvel onglet.

3. **Étant donné** un fil d'actualités, **Quand** de nouveaux articles sont
   disponibles, **Alors** l'utilisateur peut rafraîchir pour les voir.

---

### Story 3 - Noter et taguer les sources (Priorité : P2)

En tant qu'utilisateur, je veux attribuer des étoiles (notation) à mes sources et
leur associer des tags personnalisés pour organiser mes préférences.

**Pourquoi cette priorité** : Permet la personnalisation et prépare le système de
recommandations communautaires.

**Test indépendant** : L'utilisateur peut noter une source de 1 à 5 étoiles et
lui ajouter des tags qu'il a créés.

**Scénarios d'acceptation** :

1. **Étant donné** une source dans ma liste, **Quand** je lui attribue une note
   de 1 à 5 étoiles, **Alors** cette note est sauvegardée et visible sur la source.

2. **Étant donné** une source, **Quand** je crée un nouveau tag (ex: "Tech",
   "Fiable", "Local") et l'associe à la source, **Alors** ce tag apparaît sur la
   source et devient réutilisable.

3. **Étant donné** une source avec des tags, **Quand** je modifie ou supprime un
   tag, **Alors** les changements sont reflétés immédiatement.

---

### Story 4 - Découvrir des sources via la communauté (Priorité : P3)

En tant qu'utilisateur, je veux voir les sources populaires chez d'autres
utilisateurs, filtrables par tags, pour découvrir de nouvelles sources de qualité.

**Pourquoi cette priorité** : Fonctionnalité sociale qui enrichit l'expérience
mais nécessite une base d'utilisateurs.

**Test indépendant** : L'utilisateur peut parcourir les sources publiques,
filtrées par tag, et voir les notes moyennes attribuées par la communauté.

**Scénarios d'acceptation** :

1. **Étant donné** un utilisateur sur la page de découverte, **Quand** il consulte
   les sources populaires, **Alors** il voit les sources classées par note moyenne
   avec le nombre d'utilisateurs qui les suivent.

2. **Étant donné** une liste de sources communautaires, **Quand** l'utilisateur
   filtre par un tag (ex: "Tech"), **Alors** seules les sources ayant ce tag
   (attribué par au moins N utilisateurs) sont affichées.

3. **Étant donné** une source découverte, **Quand** l'utilisateur clique sur
   "Ajouter à mes sources", **Alors** elle est ajoutée à sa liste personnelle.

---

### Story 5 - Gérer son compte utilisateur (Priorité : P2)

En tant qu'utilisateur, je veux créer un compte, me connecter et gérer mes
préférences pour retrouver mes sources et paramètres sur tous mes appareils.

**Pourquoi cette priorité** : Nécessaire pour la persistance des données et les
fonctionnalités communautaires.

**Test indépendant** : L'utilisateur peut s'inscrire, se connecter, et retrouver
ses sources après déconnexion/reconnexion.

**Scénarios d'acceptation** :

1. **Étant donné** un visiteur, **Quand** il s'inscrit avec email et mot de passe,
   **Alors** son compte est créé et il est connecté automatiquement.

2. **Étant donné** un utilisateur avec un compte, **Quand** il se connecte sur un
   nouvel appareil, **Alors** il retrouve toutes ses sources, notes et tags.

3. **Étant donné** un utilisateur connecté, **Quand** il modifie ses préférences
   (langue, fréquence de rafraîchissement), **Alors** les changements sont
   sauvegardés et appliqués.

---

### Story 6 - Configurer les paramètres avancés par source (Priorité : P2)

En tant qu'utilisateur, je veux pouvoir ajuster finement le comportement de
chaque source individuellement pour optimiser mon expérience de lecture.

**Pourquoi cette priorité** : Permet une personnalisation poussée qui différencie
l'application des agrégateurs classiques et répond aux besoins des utilisateurs
exigeants.

**Test indépendant** : L'utilisateur peut modifier les paramètres d'une source
et constater que le comportement change conformément aux réglages.

**Scénarios d'acceptation** :

1. **Étant donné** une source dans ma liste, **Quand** j'accède à ses paramètres,
   **Alors** je vois tous les paramètres configurables avec leurs valeurs actuelles.

2. **Étant donné** les paramètres d'une source, **Quand** je modifie le nombre
   maximum d'articles à afficher, **Alors** seul ce nombre d'articles apparaît
   dans mon fil pour cette source.

3. **Étant donné** les paramètres d'une source, **Quand** je modifie la fréquence
   de récupération, **Alors** le système respecte cet intervalle pour cette source.

4. **Étant donné** les paramètres d'une source, **Quand** je réinitialise aux
   valeurs par défaut, **Alors** tous les paramètres reviennent à leur valeur
   système.

---

### Cas Limites

- Que se passe-t-il si une source devient inaccessible pendant plusieurs jours ?
  → La source est marquée comme "inactive" avec une notification à l'utilisateur.

- Comment gérer les doublons d'articles entre différentes sources ?
  → Détection par similarité de titre/URL, affichage d'une seule entrée avec
  mention des sources multiples.

- Que faire si le scraping échoue sur un site ?
  → Notification à l'utilisateur, suggestion de vérifier l'URL ou d'utiliser le
  flux RSS si disponible.

- Comment gérer les sites avec paywall ou contenu protégé ?
  → Afficher uniquement les métadonnées disponibles publiquement (titre, date,
  résumé du meta description).

- Que se passe-t-il si un utilisateur abuse du système (spam de sources) ?
  → Limite de 100 sources par utilisateur, avec possibilité d'extension sur
  demande.

- Que se passe-t-il si le cache devient trop volumineux ?
  → Politique d'éviction LRU (Least Recently Used) pour les articles les plus
  anciens non consultés.

- Comment gérer les métadonnées Open Graph incohérentes ou manquantes ?
  → Cascade de fallback : Open Graph → Twitter Cards → balises meta HTML →
  contenu RSS → extraction du contenu HTML.

- Que faire si un site bloque les requêtes trop fréquentes ?
  → Augmenter automatiquement l'intervalle de rafraîchissement pour cette
  source et notifier l'utilisateur.

- Que se passe-t-il si l'utilisateur configure une fréquence trop agressive ?
  → Avertissement affiché, et le système peut ajuster automatiquement si la
  source répond par des erreurs de rate limiting.

- Comment gérer les conflits entre paramètres utilisateur et limites système ?
  → Les limites système prévalent avec une explication claire à l'utilisateur.

## Exigences *(obligatoire)*

### Exigences Fonctionnelles

- **EF-001** : Le système DOIT permettre aux utilisateurs de créer un compte avec
  email et mot de passe.

- **EF-002** : Le système DOIT permettre l'ajout de sources via URL (flux RSS ou
  site web).

- **EF-003** : Le système DOIT extraire automatiquement les articles des sources
  configurées (titre, date, résumé, image, lien).

- **EF-004** : Le système DOIT afficher les articles dans un fil unifié trié par
  date.

- **EF-005** : Le système DOIT rediriger l'utilisateur vers le site source lors
  du clic sur un article.

- **EF-006** : Le système DOIT permettre de noter les sources de 1 à 5 étoiles.

- **EF-007** : Le système DOIT permettre la création et l'attribution de tags
  personnalisés aux sources.

- **EF-008** : Le système DOIT afficher les sources populaires de la communauté
  avec leurs notes moyennes.

- **EF-009** : Le système DOIT permettre de filtrer les sources communautaires
  par tags.

- **EF-010** : Le système DOIT détecter automatiquement les flux RSS sur les
  sites web quand disponibles.

- **EF-011** : Le système DOIT rafraîchir les sources périodiquement pour
  récupérer les nouveaux articles.

- **EF-012** : Le système DOIT gérer les sources inaccessibles en les marquant
  comme inactives après plusieurs échecs.

- **EF-013** : Le système DOIT détecter et fusionner les articles en doublon.

- **EF-014** : Le système DOIT limiter le nombre de sources par utilisateur à
  100 par défaut.

#### Cache Agressif

- **EF-015** : Le système DOIT mettre en cache les articles et métadonnées pour
  minimiser les requêtes vers les serveurs sources.

- **EF-016** : Le système DOIT partager le cache entre tous les utilisateurs
  suivant une même source (une seule requête par source, pas par utilisateur).

- **EF-017** : Le système DOIT respecter un intervalle minimum entre deux
  requêtes vers un même serveur source (rate limiting côté client).

- **EF-018** : Le système DOIT servir les articles depuis le cache même si la
  source est temporairement inaccessible.

- **EF-019** : Le système DOIT invalider le cache d'une source uniquement lors
  du rafraîchissement périodique programmé.

#### Extraction des Métadonnées Réseaux Sociaux

- **EF-020** : Le système DOIT extraire les métadonnées Open Graph (og:title,
  og:description, og:image, og:type, og:url) des articles.

- **EF-021** : Le système DOIT extraire les métadonnées Twitter Cards
  (twitter:title, twitter:description, twitter:image) des articles.

- **EF-022** : Le système DOIT utiliser les métadonnées sociales en priorité
  pour enrichir les articles (meilleure image, meilleur résumé).

- **EF-023** : Le système DOIT conserver les métadonnées extraites dans le
  cache pour éviter de re-parser les pages.

- **EF-024** : Le système DOIT gérer gracieusement l'absence de métadonnées
  sociales en utilisant les données RSS/HTML classiques comme fallback.

#### Paramètres Avancés par Source

- **EF-025** : Le système DOIT permettre de configurer le nombre maximum
  d'articles à afficher par source (de 1 à 100, défaut : 20).

- **EF-026** : Le système DOIT permettre de configurer la fréquence de
  récupération par source (de 5 minutes à 24 heures, défaut : 30 minutes).

- **EF-027** : Le système DOIT permettre de configurer le temps de rétention
  des articles par source (de 1 jour à 1 an, défaut : 30 jours).

- **EF-028** : Le système DOIT permettre d'activer/désactiver une source
  temporairement sans la supprimer (pause).

- **EF-029** : Le système DOIT permettre de configurer la priorité d'affichage
  d'une source (haute, normale, basse) pour pondérer son apparition dans le fil.

- **EF-030** : Le système DOIT permettre de filtrer les articles d'une source
  par mots-clés (inclusion ou exclusion).

- **EF-031** : Le système DOIT permettre de configurer le mode d'extraction
  par source (RSS uniquement, scraping uniquement, automatique).

- **EF-032** : Le système DOIT permettre de configurer les notifications par
  source (aucune, nouveaux articles uniquement, tous les événements).

- **EF-033** : Le système DOIT permettre de définir une plage horaire de
  récupération par source (ex: uniquement en journée).

- **EF-034** : Le système DOIT permettre d'exporter/importer les paramètres
  d'une source pour les partager ou les sauvegarder.

- **EF-035** : Le système DOIT afficher les valeurs par défaut et permettre
  de réinitialiser chaque paramètre individuellement ou tous à la fois.

- **EF-036** : Le système DOIT valider les paramètres et afficher des
  avertissements si les valeurs risquent de causer des problèmes (ex: fréquence
  trop élevée pouvant être bloquée par la source).

### Entités Clés

- **Utilisateur** : Représente une personne inscrite. Possède un email, mot de
  passe, préférences, et une collection de sources personnelles.

- **Source** : Représente un flux d'actualités (RSS ou site web). Possède une
  URL, un nom, un statut (active/inactive/pause), et des métadonnées (favicon, etc.).

- **ParametresSource** : Configuration personnalisée d'une source par un
  utilisateur. Inclut : nombre max d'articles, fréquence de récupération, temps
  de rétention, priorité d'affichage, filtres mots-clés, mode d'extraction,
  préférences de notification, plage horaire de récupération.

- **Article** : Représente une actualité extraite. Possède un titre, une date
  de publication, un résumé, une image, un lien vers l'original, des tags, et
  des métadonnées sociales (Open Graph, Twitter Cards) quand disponibles.

- **CacheArticle** : Représente un article mis en cache avec sa date de
  récupération, sa date d'expiration, et ses métadonnées enrichies.

- **NotationSource** : Représente la note d'un utilisateur pour une source.
  Associe un utilisateur, une source, et une note de 1 à 5.

- **Tag** : Représente une étiquette créée par un utilisateur. Possède un nom
  et peut être associé à plusieurs sources par plusieurs utilisateurs.

- **AssociationTagSource** : Lie un tag à une source pour un utilisateur donné.
  Permet le filtrage et les statistiques communautaires.

## Critères de Succès *(obligatoire)*

### Résultats Mesurables

- **CS-001** : Les utilisateurs peuvent ajouter une nouvelle source en moins de
  30 secondes.

- **CS-002** : Les articles d'une nouvelle source apparaissent dans le fil en
  moins d'une minute après l'ajout.

- **CS-003** : Le fil d'actualités affiche au moins 50 articles sans dégradation
  de performance perceptible.

- **CS-004** : 90% des utilisateurs trouvent une source pertinente via la
  découverte communautaire en moins de 2 minutes.

- **CS-005** : Le système supporte au moins 1000 utilisateurs simultanés sans
  dégradation.

- **CS-006** : 95% des flux RSS valides sont détectés et parsés correctement.

- **CS-007** : Les utilisateurs peuvent retrouver leurs données après
  reconnexion sur un nouvel appareil en moins de 10 secondes.

- **CS-008** : Le taux de détection des doublons atteint au moins 85%.

- **CS-009** : 90% des requêtes utilisateurs sont servies depuis le cache sans
  solliciter les serveurs sources.

- **CS-010** : Le système effectue au maximum une requête par source par
  intervalle de rafraîchissement, quel que soit le nombre d'utilisateurs.

- **CS-011** : 80% des articles affichent une image de qualité extraite des
  métadonnées sociales (Open Graph ou Twitter Cards).

- **CS-012** : Les articles restent accessibles depuis le cache pendant au
  moins 24h même si la source devient inaccessible.

- **CS-013** : Les utilisateurs peuvent configurer les paramètres d'une source
  en moins de 60 secondes.

- **CS-014** : 95% des utilisateurs comprennent l'effet de chaque paramètre
  grâce aux libellés et descriptions.

- **CS-015** : Les paramètres personnalisés sont appliqués en moins de 5
  secondes après modification.

## Hypothèses

- Les utilisateurs ont accès à internet de manière stable.
- Les sites sources respectent les standards RSS/Atom ou ont une structure HTML
  suffisamment prévisible pour le scraping.
- Les utilisateurs acceptent de partager publiquement leurs notes et tags pour
  la fonctionnalité communautaire (opt-in par défaut).
- Le scraping respecte les fichiers robots.txt des sites sources.
- Les images des articles sont hébergées sur les sites sources (pas de stockage
  local).
