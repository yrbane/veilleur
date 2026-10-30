# Changelog

Toutes les évolutions notables de Veilleur sont consignées ici. Le format suit
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le versionnage
[SemVer](https://semver.org/lang/fr/).

## 0.21.1 — 2026-10-30 · « Images en cache comptées »

### Corrigé
- Tableau de bord : le compteur « Images en cache » affichait 0 ; il compte désormais les images réellement mises en cache (statut terminé) au lieu d'une colonne d'article jamais renseignée.

## 0.21.0 — 2026-10-30 · « Tableau de bord »

### Ajouté
- Rôle utilisateur `membre` / `admin` (migration 0011) : le premier compte de l'instance devient administrateur ; script de secours `npm run admin:promouvoir:prod -- <email>`.
- Page `/admin` réservée aux administrateurs, avec lien « Admin » dans la navigation : vue d'ensemble (comptes, actifs de la semaine, sources, articles, lectures, images en cache), graphiques Chart.js (activité sur 30 jours, heures de publication, sources par type, images par statut, notes attribuées, sources les plus suivies, rubriques, nuage des mots-clés), couleurs tirées du thème et reconstruites au changement clair / sombre.
- Onglet Comptes : liste paginée avec recherche, changement de rôle, désactivation (sessions révoquées), suppression complète d'un compte avec confirmation. Un administrateur ne peut ni se rétrograder ni se supprimer, et l'instance garde toujours au moins un administrateur.
- Onglet Sources : liste paginée (type, statut, échecs, abonnés, articles, dernière synchro), synchronisation prioritaire et activation / désactivation d'une source (échecs remis à zéro).
- Onglet Système : version, Node, durée de service, mémoire du processus, état et mémoire de Redis, taille de la base, compteurs des files BullMQ.
- API `/api/v1/admin/*` protégée par un garde qui relit le rôle en base à chaque requête (401 puis 403 `ACCES_REFUSE`) ; les statistiques sont anonymes (aucune adresse hors de la gestion des comptes).

### Corrigé
- Les résumés d'articles n'affichent plus d'entités HTML en clair (`&nbsp;`, `&amp;`) : le texte était échappé deux fois avant d'être inséré comme nœud texte.

## 0.20.0 — 2026-10-30 · « Barre compacte »

### Ajouté
- Barre de commandes du fil sur une seule ligne : recherche, tri, bouton « Filtres »
  qui déplie un panneau (source, période, note) avec le nombre de filtres actifs en
  badge, bascules Favoris / À lire / Non lus soudées, « Tout marquer lu » et le
  sélecteur Liste / Tuiles.
- Rail de filtres rapides sur la deuxième ligne : rubriques, tendances du fil et
  mots-clés fréquents côte à côte, défilement horizontal avec fondu, bouton pour
  tout déplier ; un mot déjà en tendance n'est plus répété dans les mots-clés.
- Composants réutilisables `Popover` (menu déroulant accessible : ARIA, Échap,
  clic en dehors) et `RailPuces`, couverts par des tests.

### Modifié
- Synchronisation manuelle d'une source : le retour indique aussi le nombre total
  d'articles de la source, et le message dit « Source à jour : N articles déjà dans
  votre fil » plutôt que « 0 nouveaux articles » quand le flux est déjà connu
  (cas d'un flux partagé par plusieurs comptes, comme Reporterre).
- Sur mobile, la recherche prend toute la largeur et les bascules passent en icônes.

## 0.19.0 — 2026-10-30 · « Pleine largeur et tuiles »

### Ajouté
- Le fil se lit en liste (une carte par ligne, comme avant) ou en tuiles :
  grille fluide de cartes avec l'image en bandeau, titre et résumé sur trois
  lignes, actions calées en bas. Sélecteur Liste / Tuiles dans la barre
  d'outils, choix mémorisé dans le navigateur
  (`src/client/utils/affichageArticles.ts`, testé).

### Modifié
- Mise en page fluide : plus de largeur maximale de 1200 px, l'en-tête et le
  contenu occupent toute la fenêtre avec des marges latérales qui suivent
  l'écran (`--gouttiere`, de 1 à 3 rem). En liste, titre et résumé gardent
  une longueur de ligne lisible (110 caractères au plus).

## 0.18.1 — 2026-10-30 · « Tags de sources sérialisés »

### Corrigé
- L'API « sources » déclarait les tags comme objets sans propriétés : Fastify les
  renvoyait vides (`{}`), les badges de « Mes sources » s'affichaient sans nom
  et, depuis la 0.18.0, la page échouait en calculant une couleur sans nom.
  Schéma partagé `src/api/schemas/tag.ts` (id, nom, slug, dateCreation),
  testé à la sérialisation.

## 0.18.0 — 2026-10-30 · « Tags en couleurs »

### Ajouté
- Chaque tag a sa couleur, dérivée de son nom : le nom normalisé (sans casse
  ni accents) est haché puis projeté sur une roue de 24 teintes espacées de
  15° à partir de la teinte primaire du thème. Chroma et luminosité sont
  communs à tous les tags, les couleurs restent donc harmonieuses entre
  elles et avec Lunar Aurora ; le thème sombre n'ajuste que les luminosités.
- Appliqué partout où un tag s'affiche : puces de rubriques du fil (fond
  teinté, plein quand la rubrique est active, pastille de non-lus assortie),
  badges des sources dans « Mes sources », tags populaires et mini-badges de
  la Découverte. Un même tag garde sa couleur d'une page à l'autre.
- Module `src/client/utils/couleursTags.ts` (`teinteTag`, `colorerTag`),
  testé.

### Modifié
- « Mes sources » : le badge de tag (et son bouton de retrait) n'est plus
  construit en double pour l'affichage initial et l'ajout.

## 0.17.2 — 2026-10-21 · « Installeur fiabilisé »

### Corrigé
- L'installeur nethttp lançait migrations et seed après un `source` bash du
  `.env` de production ; la valeur non quotée de `SCRAPING_USER_AGENT`
  (parenthèses) arrêtait la lecture à la ligne 28 et les variables suivantes
  (`APP_URL`, VAPID, SMTP) manquaient en silence. Ces scripts passent désormais
  par `systemd-run` avec le même `EnvironmentFile` que le service, et un échec
  fait échouer le déploiement.
- Gabarits `deploy/nethttp/env.production` et `.env.example` : les valeurs
  contenant espaces, parenthèses ou chevrons sont entre guillemets doubles.
  Un test vérifie que chaque valeur reste sourçable par bash et que
  l'installeur ne « source » plus le `.env`.

## 0.17.1 — 2026-10-21 · « Lunar Aurora assaini »

### Modifié
- Lunar Aurora mis à jour (PR yrbane/lunar-aurora#16, contribuée depuis ce
  projet) : sélecteurs `.2xl`… échappés, règle `:where(@media …)` invalide
  retirée, police Google isolée dans `icons-font.css`. Le build ne produit plus
  aucun avertissement CSS.
- Le client importe désormais les couches Lunar une à une depuis
  `src/client/styles/aurora.css`, sans `icons-font.css` : le plugin PostCSS qui
  supprimait le `@font-face` Google au build disparaît.

## 0.17.0 — 2026-10-21 · « Application installable »

### Ajouté
- Veilleur est une PWA : manifeste (`/manifest.webmanifest`, icônes 192/512
  + maskable, raccourcis « Non lus » et « Découverte »), couleur de thème,
  icône Apple. Installable depuis le navigateur ; Paramètres → « Application »
  propose l'installation quand le navigateur le permet.
- Service worker désormais bundlé depuis `src/client/sw.ts` (stratégies
  pures et testées dans `src/client/sw/strategies.ts`) : coque mise en cache
  à l'installation, ressources empreintées servies depuis le cache, navigation
  réseau d'abord avec la coque en secours hors ligne ; l'API et les autres
  origines ne sont jamais mises en cache. Les anciens caches sont purgés à
  chaque nouvelle version.
- Toast « Nouvelle version disponible » quand un service worker plus récent
  prend la main.

### Modifié
- Favicon : lettre en gras et police sans empattement (les icônes PNG en sont
  rasterisées).

## 0.16.1 — 2026-10-21 · « Courriel via le relais local »

### Corrigé
- Résumé courriel impossible en production (`DEPTH_ZERO_SELF_SIGNED_CERT`) :
  le Postfix local propose STARTTLS avec un certificat auto-signé. Le transport
  parle désormais en clair quand `SMTP_HOST` est en boucle locale
  (`127.0.0.1`, `localhost`, `::1`) et `SMTP_SECURE` est faux ; TLS et
  authentification inchangés pour un serveur distant.

## 0.16.0 — 2026-10-21 · « Notifications »

### Ajouté
- Notifications Web Push : après chaque synchronisation globale, les abonnés
  des sources qui ont reçu de nouveaux articles sont prévenus (« 12 nouveaux
  articles · Le Monde, franceinfo »), au plus une fois par demi-heure
  (`NOTIFICATIONS_PUSH_INTERVALLE_MIN`). Le réglage « Notifications » déjà
  présent dans les paramètres de chaque source est enfin honoré (« aucune »
  coupe la source). Clic sur la notification → fil des non-lus.
- Paramètres → « Notifications » : activer / désactiver sur cet appareil,
  nombre d'appareils, bouton « Envoyer un test ». Service worker `/sw.js`
  enregistré au chargement (base de la future PWA).
- Résumé courriel des articles non lus, chaque matin à 7 h ou le lundi matin
  (préférence `resumeCourriel`), groupé par source, texte brut + HTML, lien de
  désabonnement ; bouton « M'envoyer un aperçu ». Rien n'est envoyé quand il
  n'y a rien à lire.
- API : `GET /notifications/push/cle-publique`, `GET /notifications/etat`,
  `POST`/`DELETE /notifications/push/abonnements`, `POST /notifications/push/test`,
  `POST /notifications/resume/test`.
- Migration `0010_abonnements_push` (table `abonnements_push`), worker BullMQ
  `resumes` (cron 7 h), dépendances `web-push` et `nodemailer`.
- Configuration : `APP_URL`, `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` /
  `VAPID_SUBJECT` (push désactivé sans clés), `SMTP_HOST` / `SMTP_PORT` /
  `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` (courriel
  désactivé sans hôte). Voir `.env.example`.

## 0.15.0 — 2026-10-21 · « Communauté et parcours »

### Ajouté
- Page « Mon parcours » (`/progression`, lien « Parcours » dans la barre) :
  points, niveau (Éclaireur → Oracle, six paliers), barre vers le palier
  suivant, série de jours de lecture (courante et record), détail des points
  par activité, douze badges avec avancement (Première lecture, Lecteur assidu,
  Dévoreur, Critique, Collectionneur, Curieux, Encyclopédiste, Archiviste,
  Lève-tôt, Marathon, Régulier, Inarrêtable).
- Classement public sur la base du volontariat : case « Apparaître dans le
  classement » + pseudo (préférences `classementPublic`, `pseudo`). Seuls
  pseudo, points, niveau, badges et série sont exposés ; calcul en cache 10 min.
- Découverte : « Les plus appréciés cette semaine » (articles les plus mis en
  favoris et notés par l'ensemble des utilisateurs, visible sans compte) et
  « Suggestions pour vous » (sources suivies par les lecteurs qui partagent
  vos sources, que vous ne suivez pas encore).
- Partage d'un article depuis sa carte : partage natif du navigateur quand il
  existe, sinon copie du lien.
- API : `GET /api/v1/progression`, `GET /api/v1/communaute/classement`,
  `GET /api/v1/communaute/articles-apprecies`, `GET /api/v1/communaute/suggestions`.
- Toute la gamification se déduit de l'activité existante (lectures, notes,
  favoris, sources, rubriques) : aucune table ni migration supplémentaire.

## 0.14.0 — 2026-10-21 · « Mots-clés tendance »

### Ajouté
- Tendances : les mots-clés qui montent, comparés entre les dernières 24 h et
  la moyenne quotidienne des 7 jours précédents (score = récents / (moyenne + 1)).
  Bloc « Tendances dans votre fil » sur l'accueil (clic = filtre par mot-clé) et
  « Tendances du moment » sur la Découverte, calculées sur tous les articles,
  visibles sans compte ; un clic ouvre le fil filtré (`/?motCle=…`).
- API : `GET /api/v1/tendances` (public) et `GET /api/v1/tendances/fil`
  (authentifié), paramètre `limite` (1-30). Résultat en cache 10 minutes.
- Dépôt : `compterMotsCles` (comptage par mot-clé sur une fenêtre de publication,
  global ou restreint aux sources actives d'un utilisateur).

## 0.13.0 — 2026-10-21 · « Rubriques »

### Ajouté
- Rubriques dans le fil : les tags posés sur vos sources deviennent une barre
  de puces au-dessus des outils (« Toutes » + une puce par rubrique, avec le
  nombre d'articles non lus). Un clic restreint le fil aux sources de la
  rubrique ; le choix est mémorisé.
- `GET /api/v1/articles/non-lus` renvoie aussi `parTag` (non-lus par rubrique) ;
  le client envoie `tag` sur le fil (critère déjà géré côté serveur).

## 0.12.0 — 2026-10-21 · « Recherche enrichie »

### Ajouté
- Filtres « Source » (liste de vos sources) et « Période » (24 h, 7 jours,
  30 jours) dans la barre du fil, mémorisés comme les autres filtres.
- Surlignage des termes recherchés dans le titre et le résumé des cartes
  (termes positifs seulement, insensible à la casse, jamais interprété en HTML).
- Syntaxe de recherche expliquée dans le champ : `-mot` exclut, `"phrase
  exacte"`, `préfixe*` (mode booléen MariaDB déjà en place côté serveur).
- Paramètre `depuis` envoyé par le client sur `GET /api/v1/articles/fil`.

## 0.11.0 — 2026-10-21 · « Liste de lecture et export des annotations »

### Ajouté
- Liste de lecture : bouton « Lire plus tard » (signet) sur chaque carte,
  puce « À lire » dans la barre du fil pour n'afficher que les articles mis de
  côté. Colonne `a_lire` (migration `0009`).
- Export des annotations depuis Paramètres › Mes données, en JSON ou CSV
  (titre, lien, source, date, note, favori, à lire, lu, dernière mise à jour).
  CSV RFC 4180, séparateur « ; », BOM UTF-8 pour Excel.
- API : `PUT /api/v1/articles/:id/a-lire`, `GET /api/v1/articles/export?format=json|csv`,
  paramètre `aLire=true` sur le fil, champ `aLire` sur chaque article.

### Modifié
- Boutons favori et liste de lecture construits par un même composant à deux
  états ; téléchargement de fichier factorisé entre l'export OPML et celui des
  annotations.

## 0.10.2 — 2026-10-21 · « Images du lecteur en local, quota assaini »

### Corrigé
- Les images du lecteur passent désormais par le cache local d'images (mise
  en file du téléchargement à l'extraction, adresse `/api/v1/images/<hash>/md`) :
  le navigateur ne contacte jamais le site d'origine et la politique de
  sécurité (`img-src 'self'`) ne les bloque plus. Une image encore absente du
  cache est redemandée jusqu'à trois fois puis retirée.
- Limite de requêtes : l'objet levé par le plugin n'avait pas de `statusCode`,
  le dépassement ressortait en 500 « Erreur non gérée » ; il répond 429 avec
  `retryAfter`. Les routes d'images et de favicons, appelées par dizaines à
  chaque page, ne comptent plus dans le quota par IP.

## 0.10.1 — 2026-10-21 · « jsdom en production »

### Corrigé
- `jsdom`, requis par l'extraction de lecture, était resté en dépendance de
  développement : le serveur de production ne démarrait plus (`ERR_MODULE_NOT_FOUND`).
  Déplacé en dépendance d'exécution.

## 0.10.0 — 2026-10-21 · « Lecture en place »

### Ajouté
- Bouton « Lire ici » sur chaque carte : l'article s'ouvre dans une fenêtre de
  lecture sans quitter le fil, avec source, date, auteur, durée de lecture
  estimée et lien vers l'original. Échap ou un clic à côté referme ; l'article
  est marqué lu.
- Extraction côté serveur (`ServiceLecture`) : page téléchargée avec les
  garde-fous du scraping (anti-SSRF, redirections validées, 2 Mo max, HTML
  seulement), contenu principal isolé par Readability puis nettoyé par
  sanitize-html (balises de mise en forme uniquement, images en https, liens
  absolus ouverts dans un nouvel onglet). Résultat en cache Redis 24 h.
- API : `GET /api/v1/articles/:id/lecture` (422 `CONTENU_INDISPONIBLE` quand le
  site ne s'y prête pas).
- Récupération HTTP avec redirections validées factorisée
  (`recupererAvecRedirections`), partagée avec le cache des favicons.

## 0.9.3 — 2026-10-21 · « Tout marquer lu, vraiment »

### Corrigé
- Le `ON DUPLICATE KEY UPDATE` de « Tout marquer lu » référençait `lu_le` sans
  préfixe alors que la table est jointe à elle-même : colonne ambiguë. Les
  colonnes mises à jour sont qualifiées ; requête validée sur la base de prod.

## 0.9.2 — 2026-10-21 · « Tout marquer lu réparé »

### Corrigé
- « Tout marquer lu » répondait 500 : l'alias Drizzle de `utilisateurs_articles`
  interpolé dans la requête brute ne produisait que son nom (`LEFT JOIN ua`).
  La jointure est écrite explicitement (`utilisateurs_articles AS ua`).

## 0.9.1 — 2026-10-21 · « Verrou npm complété »

### Corrigé
- `package-lock.json` ne listait pas `fflate` (dépendance de `@vitest/ui`),
  ce qui faisait échouer `npm ci` en CI et bloquait le déploiement de la 0.9.0.
  Le verrou est régénéré avec `npm install --package-lock-only` et validé par
  `npm ci --dry-run`.

## 0.9.0 — 2026-10-21 · « Lu, non lu »

### Ajouté
- Articles lus / non lus : ouvrir un article le marque lu, un bouton sur chaque
  carte bascule l'état, les cartes lues sont atténuées.
- Filtre « Non lus » dans la barre du fil, compteur « Non lus » dans les
  statistiques, badge de non-lus sur chaque carte de la page Mes sources.
- « Tout marquer lu » : borné à l'instant du clic pour ne pas avaler les
  articles arrivés entre-temps ; peut viser une seule source via l'API.
- API : `PUT /api/v1/articles/:id/lu`, `POST /api/v1/articles/lus`,
  `GET /api/v1/articles/non-lus`, paramètre `nonLus=true` sur le fil, champ `lu`
  sur chaque article.
- Migration `0008` : colonne `lu_le` et index sur `utilisateurs_articles`.

## 0.8.2 — 2026-10-20 · « Favicons du fil et thème retenu par le compte »

### Corrigé
- Le fil ne renvoyait pas `sourceId` (absent du schéma de réponse) : les
  favicons des articles pointaient vers `/api/v1/favicons/undefined`.
- Le bouton de thème de l'en-tête enregistre aussi le choix dans les
  préférences du compte, et la page Paramètres affiche le thème réellement
  appliqué sur l'appareil.

## 0.8.1 — 2026-10-20 · « Fichier de verrou resynchronisé »

### Corrigé
- `package-lock.json` était désynchronisé après l'ajout de jsdom (`iconv-lite`),
  ce qui faisait échouer `npm ci` en CI et bloquait le déploiement de la 0.8.0.

## 0.8.0 — 2026-10-20 · « Favicons en cache, thème en un clic »

### Ajouté
- Cache local des favicons : `GET /api/v1/favicons/:sourceId` télécharge une
  fois le favicon de la source (URL validée contre le SSRF, redirections
  contrôlées, 256 Ko max, types image seulement), le garde sous
  `IMAGES_CHEMIN_STOCKAGE/favicons/` et le sert depuis l'origine de Veilleur.
  Le navigateur ne contacte plus jamais les sites sources ; un échec n'est pas
  réessayé pendant une heure, un fichier périmé est resservi si le site ne
  répond plus.
- Bouton de thème dans l'en-tête (automatique → clair → sombre), synchronisé
  avec le sélecteur de la page Paramètres.
- Bouton « revenir en haut » dès que l'on a défilé le fil, et raccourci clavier
  `/` qui place le curseur dans la recherche.
- Œil pour afficher ou masquer les mots de passe (connexion, inscription,
  changement de mot de passe).

### Modifié
- Barre d'outils du fil sur une seule ligne : tri, note et favoris côte à côte.
- Navigation compacte sur mobile : icônes seules, libellés conservés pour les
  lecteurs d'écran et en infobulle.
- La réponse du fil expose `sourceId` sur chaque article (utilisé pour le
  favicon).

### Corrigé
- La police Google déclarée par Lunar Aurora est retirée au build (plugin
  PostCSS) : plus d'erreur CSP dans la console à chaque chargement.
- Côté serveur, le vhost Apache ne superpose plus sa CSP globale à celle de
  l'application : les favicons et images externes autorisés par helmet ne sont
  plus bloqués par l'intersection des deux en-têtes.

## 0.7.1 — 2026-10-20 · « Icônes servies par Veilleur »

### Corrigé
- Les icônes s'affichaient par leur nom (« star », « settings »…) en production :
  Lunar Aurora déclare aussi « Material Symbols Outlined » depuis
  fonts.gstatic.com, que la CSP (`font-src 'self'`) bloque, et le navigateur ne
  retombait pas sur la police locale. La police auto-hébergée est désormais
  déclarée sous le nom « Material Symbols Veilleur » et portée par la seule
  classe `.icone`.

## 0.7.0 — 2026-10-20 · « Interface Lunar Aurora et icônes Material »

### Ajouté
- L'interface repose désormais sur le framework CSS [Lunar Aurora](https://github.com/yrbane/lunar-aurora)
  (boutons, champs, badges, puces, toasts, états vides, squelettes, spinner,
  statistiques) importé avec ses `@layer`, ce qui laisse la main aux styles
  propres à Veilleur.
- Icônes Google Material Symbols (police auto-hébergée, aucune requête externe)
  à la place des emojis : navigation, actions des cartes, étoiles de notation,
  favoris, états vides, toasts. Helper `icone()` / `iconeHtml()` et option
  `icone` de `creerElement`.
- Thème clair / sombre / automatique réellement appliqué : mémorisé dans le
  navigateur et restauré au chargement (attribut `data-theme` lu par Lunar).

### Modifié
- Les variables CSS de Veilleur (`--couleur-*`, `--espace-*`, `--rayon-*`…)
  sont des alias des tokens Lunar : les thèmes sombres et clairs s'appliquent à
  tout, sans doublon de palette.
- Boutons d'action des cartes et de retrait de tag dotés de libellés
  accessibles (`aria-label`), toasts avec rôle `status` / `alert`.
- Les tests E2E repèrent les étoiles par leur classe active plutôt que par le
  caractère « ★ ».

### Supprimé
- `reset.css` et les blocs CSS devenus redondants (boutons, formulaires,
  badges, toasts, squelettes, spinner, messages vides).

## 0.6.3 — 2026-10-20 · « Carte complète dès l'ajout »

### Corrigé
- La réponse de `POST /api/v1/sources` renvoie désormais le favicon, les tags,
  la note et l'état de pause : la carte de la source fraîchement ajoutée les
  affiche sans recharger la page.

 · « Tags de source réellement posés »

### Corrigé
- Les tags d'une source (déduits ou saisis à la main) étaient liés à
  l'identifiant de la source au lieu de celui de l'abonnement : ils
  n'apparaissaient jamais. Les routes `POST/DELETE/GET /api/v1/tags/sources/:id/tags`
  et l'ajout automatique passent désormais par l'abonnement
  (`SourceUtilisateur.utilisateurSourceId`).
- Les tags suggérés mémorisés sur la source sont relus correctement avec MariaDB,
  qui renvoie la colonne JSON sous forme de chaîne.

 · « Détection plus robuste des tags »

### Corrigé
- Un flux dont les `<category>` portent des attributs (`domain=…`, cas de
  Blast) était pris pour une page HTML : la source n'avait ni tags ni flux.
- Les catégories techniques (slugs `jeux-video/actualites-gaming`, `no_ads`),
  les libellés de moins de trois caractères et les noms propres des titres ne
  sont plus proposés comme tags.
- Un favicon encodé en `data:` n'est plus enregistré ; `/favicon.ico` à la
  racine du site est utilisé à la place.

 · « Favicon et tags de la source récupérés à l'ajout »

### Ajouté
- **À l'ajout d'une source, son favicon et ses tags sont récupérés
  automatiquement**, sans saisie de l'utilisateur :
  - le favicon est lu sur la page d'accueil du site (balises `<link rel="icon">`,
    `apple-touch-icon`…), même quand l'utilisateur colle directement l'adresse
    d'un flux ; à défaut `/favicon.ico` à la racine ;
  - les tags (cinq au plus) viennent des catégories déclarées par le flux, puis
    des catégories les plus fréquentes de ses articles, puis des mots-clés de la
    page du site, et en dernier recours des mots-clés extraits des titres.
    Les catégories creuses (« Actualités », « Uncategorized »…) sont écartées.
- Les tags déduits sont mémorisés sur la source (`sources.tags_suggeres`,
  migration `0007`) et repris pour chaque utilisateur qui l'ajoute ensuite.
  Ils restent modifiables : retrait et ajout manuels fonctionnent comme avant.
- `npm run sources:rattraper:prod` (`dist/rattraper-sources.js`) : complète le
  favicon et les tags des sources déjà en base et tague les abonnements qui
  n'avaient encore aucun tag.

 · « Mots-clés plus justes »

### Corrigé
- Les finales invariables en -ès (procès, succès, accès) ne sont plus
  tronquées, et les noms propres gardent leur forme (« Limoges », « Rennes »).
- Les mots creux des titres de presse (comment, pourquoi, face, gens, façon,
  fois, cas, point…) sont écartés des mots-clés.

 · « Classement automatique par mots-clés »

### Modifié
- **Le classement des articles ne dépend plus de l'utilisateur** : à chaque
  synchronisation, Veilleur extrait les cinq mots-clés les plus significatifs
  du titre et du résumé (titre pondéré, noms propres favorisés, mots vides
  français et anglais écartés, pluriels regroupés, sans modèle externe).
  Ils s'affichent sur chaque carte et un clic filtre le fil dessus ; les
  quinze mots-clés les plus fréquents du fil servent de filtres en haut de
  page (`GET /api/v1/articles/mots-cles`, paramètre `motCle` du fil).
- Les tags manuels d'articles introduits en 0.4.0 sont retirés (routes
  `PUT /api/v1/articles/:id/tags` et `GET /api/v1/articles/tags`, table
  `utilisateurs_articles_tags` supprimée par la migration
  `0006_mots_cles_articles`). Les tags de sources sont inchangés.

### Ajouté
- `npm run mots-cles:rattraper:prod` (`dist/rattraper-mots-cles.js`) : extrait
  les mots-clés des articles déjà en base.

 · « Le fil reflète immédiatement les sources ajoutées »

### Corrigé
- Après l'ajout, le retrait ou la mise en pause d'une source, le fil restait
  sur sa version en cache jusqu'à 60 s : un nouvel inscrit qui ajoutait sa
  première source voyait encore « Aucun article ». Le cache du fil est
  désormais invalidé en même temps que celui des sources.

 · « Noter, classer, trier et retrouver ses articles »

### Ajouté
- **Note par article** (1 à 5 étoiles, personnelle) : cliquer sur l'étoile de
  la note courante la retire. `PUT /api/v1/articles/:id/note`.
- **Favoris** : cœur sur chaque carte, filtre « ♥ Favoris » en haut du fil.
  `PUT /api/v1/articles/:id/favori`.
- **Classement par tags** sur les articles : badges retirables et champ
  « Classer… » sur chaque carte ; les tags posés apparaissent comme filtres
  au-dessus du fil avec le nombre d'articles. `PUT /api/v1/articles/:id/tags`
  et `GET /api/v1/articles/tags`.
- **Tri du fil** : plus récents, plus anciens, mieux notés, titre A → Z,
  source A → Z (`tri` et `ordre` sur `GET /api/v1/articles/fil`), plus un
  filtre de note minimale (`noteMin`), de favoris (`favoris=true`) et de tag
  d'article (`tagArticle`). Les filtres sont mémorisés dans le navigateur.
- **Barre de recherche** en haut du fil, plein texte sur le titre et le résumé
  de tous les articles des sources suivies (déclenchée à la frappe).
- **Chargement au défilement** : les boutons « Précédent / Suivant » laissent
  place à un chargement automatique de la suite du fil.
- Migration `0005_annotations_articles` : tables `utilisateurs_articles`
  (note, favori) et `utilisateurs_articles_tags`.

### Corrigé
- Le total paginé du fil ignorait les filtres (source, recherche) et annonçait
  trop de pages.

 · « Découverte automatique du flux et du protocole »

### Ajouté
- **Ajout d'une source par l'adresse du site** : coller `mediapart.fr` ou
  `https://www.blast-info.fr` suffit. Veilleur cherche le flux déclaré par la
  page (`<link rel="alternate" type="application/rss+xml">`), puis les chemins
  usuels (`/feed`, `/rss`, `/rss.xml`, `/feed.xml`, `/atom.xml`, `/index.xml`,
  `/feeds/posts/default`, `?feed=rss2`) et enregistre l'URL du flux trouvé.
  Les liens visibles vers un flux sont aussi suivis, même sur un autre hôte
  (Blast → `api.blast-info.fr/rss.xml`). Si le site n'expose aucun flux, la
  page est enregistrée en source HTML (scraping) au lieu d'un faux flux RSS
  qui échouait à chaque synchronisation. La détection est bornée (5 s par
  requête, 15 s au total).
- **Protocole deviné** : une saisie sans `http(s)://` est essayée en https
  puis en http. Le formulaire et l'API acceptent désormais une adresse nue ;
  un hôte sans domaine (`not-a-valid-url`) reste refusé, et un site qui ne
  répond sur aucun protocole est refusé avec « Site injoignable » plutôt
  qu'enregistré comme source morte.
- Si le flux découvert est déjà suivi par d'autres utilisateurs, la source
  existante est réutilisée au lieu d'être dupliquée.

 · « Menu connecté et cache d'images effectif »

### Corrigé
- **Menu invisible après connexion** : l'en-tête restait sur « Connexion /
  Inscription » et « Mes sources » restait masqué jusqu'à un rechargement
  complet, car l'état d'authentification n'était rafraîchi qu'au démarrage.
  Le routeur le rafraîchit désormais à chaque navigation.
- **Images en 404 malgré le cache** : le worker écrivait bien les fichiers mais
  la ligne `images_cachees` n'était jamais créée (les jobs enfilés par la
  synchronisation ne passaient pas par `demanderCache`), donc toutes les mises
  à jour de statut tombaient dans le vide et l'API répondait 404, le client
  retombant sur l'URL d'origine. `traiterImage` crée la ligne si elle manque.

### Ajouté
- `npm run images:rattraper:prod` (`dist/rattraper-images.js`) : ré-enfile les
  images d'articles absentes du cache, pour rattraper celles traitées avant ce
  correctif.

 · « Images des flux media:group »

### Corrigé
- **Images absentes pour les flux qui enveloppent `media:content` dans
  `media:group`** (Blast, YouTube…) : l'extracteur RSS lit désormais le groupe
  (`media:content` puis `media:thumbnail`), donc ces images sont mises en cache
  comme les autres. Blast passe de 0 à 49 images sur 50 ; Mediapart
  (`media:content` direct) était déjà couvert.

## 0.2.2 — 2026-10-20 · « Inscription réparée »

### Corrigé
- **Inscription et connexion impossibles en production** (erreur 500
  `Unknown column 'totp_secret'`) : les colonnes 2FA `totp_secret` et
  `totp_actif` de `utilisateurs` étaient déclarées dans le schéma Drizzle mais
  n'avaient jamais eu de migration (posées en dev par `drizzle-kit push`).
  Migration `0004_totp_utilisateurs` idempotente.

## 0.2.1 — 2026-10-20 · « Déploiement continu »

### Ajouté
- **Workflow GitHub Actions** `.github/workflows/deploy-nethttp.yml` : à chaque push
  ou pull request, lint + typecheck + tests + build ; à chaque push (merge) sur
  `main`, déploiement automatique sur https://news.nethttp.net avec le même
  installeur que `npm run deploy:nethttp`, puis contrôle que `/api/v1/health`
  sert la version publiée. Secrets `NETHTTP_SSH_KEY` (clé ed25519 dédiée) et
  `NETHTTP_KNOWN_HOSTS`.

## 0.2.0 — 2026-10-20 · « Cache d'images et mise en ligne sur news.nethttp.net »

### Ajouté
- **Cache d'images local** : les illustrations des articles sont téléchargées en
  arrière-plan (worker BullMQ `WorkerImages`), redimensionnées en miniatures avec
  `sharp` et servies par `GET /api/v1/images/:hash` ; la carte article retombe en
  cascade sur l'URL d'origine puis sur un placeholder.
- **Table `images_cachees`** et colonne `articles.url_image_cache` (migrations
  Drizzle `0001` → `0003`), dépôt `DepotImagesCacheMariaDB`, clés Redis dédiées.
- **Recherche plein texte** : index FULLTEXT sur `titre`/`resume` et requêtes en
  mode booléen (`+mot -mot`).
- **Squelettes de chargement** (`SkeletonArticle`) sur le fil d'actualités.
- **Sources par défaut** (`npm run db:seed`, `make seed`) : médias engagés et
  scientifiques, insertion idempotente.
- **Déploiement sur news.nethttp.net** : `npm run deploy:nethttp` construit
  l'application, l'envoie par rsync et exécute `deploy/nethttp/installer.sh`
  (Node 22 isolé dans `/opt/nodejs`, utilisateur système `veilleur`, base MariaDB
  et secrets générés au premier passage, service systemd durci, vhost Apache en
  reverse proxy derrière websec, migrations à chaque déploiement).
- **Version unique** : `src/config/version.ts` lit `package.json` ; l'API
  (`/api/v1/health`, Swagger) et le pied de page du client affichent la même
  version (injectée par Vite).

### Modifié
- **Build serveur exécutable** : `npm run build` type-vérifie puis bundle le
  serveur avec esbuild (`dist/serveur.js`, `dist/migrer.js`, `dist/seed.js`).
  Le simple `tsc` laissait les alias `@/` et les imports sans extension, donc un
  `dist/` que Node ne pouvait pas lancer. `npm start` lance `dist/serveur.js`.
- **Migrations sans drizzle-kit** en production : `dist/migrer.js` s'appuie sur
  le migrateur intégré à drizzle-orm.
- Le frontend construit est résolu depuis le répertoire de travail
  (`dist/client`), ce qui fonctionne en dev, en bundle et en Docker.
- Image Docker de production : dépendances installées avec `npm ci --omit=dev`
  et point d'entrée `dist/serveur.js`.
- Insertion des articles par lot lors de la synchronisation ; cache Redis des
  sources invalidé correctement.
- ESLint analyse désormais `tests/` et `scripts/` (`tsconfig.eslint.json`) ;
  les 9 erreurs restantes ont été corrigées.

### Corrigé
- La migration manuelle `0002_add_image_cache_column.sql` (hors journal, syntaxe
  `DELIMITER` non supportée par le migrateur) est remplacée par `0003`, journalisée
  et idempotente : une base neuve obtient bien la colonne `url_image_cache`.
- Un asset absent sous `/assets/` renvoie 404 au lieu de l'index SPA (que le proxy met en cache un an) ; le logger journalise la vraie version.
- `dist/serveur.js` ne démarre plus le serveur deux fois (garde « module
  principal » retirée de `serveur.ts`, le point d'entrée est `src/index.ts`).

## 0.1.0 — 2025-12-05 · « Agrégateur d'actualités »

- Première version : API Fastify, agrégation RSS/HTML, comptes utilisateurs avec
  JWT et 2FA, sources, tags, notation, découverte, client Web Components, tests
  unitaires, d'intégration et E2E Playwright, environnement Docker.
