# Changelog

Toutes les évolutions notables de Veilleur sont consignées ici. Le format suit
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le versionnage
[SemVer](https://semver.org/lang/fr/).

## 0.2.4 — 2026-10-20 · « Menu connecté et cache d'images effectif »

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
