<p align="center">
  <pre>
██╗   ██╗███████╗██╗██╗     ██╗     ███████╗██╗   ██╗██████╗ 
██║   ██║██╔════╝██║██║     ██║     ██╔════╝██║   ██║██╔══██╗
██║   ██║█████╗  ██║██║     ██║     █████╗  ██║   ██║██████╔╝
╚██╗ ██╔╝██╔══╝  ██║██║     ██║     ██╔══╝  ██║   ██║██╔══██╗
 ╚████╔╝ ███████╗██║███████╗███████╗███████╗╚██████╔╝██║  ██║
  ╚═══╝  ╚══════╝╚═╝╚══════╝╚══════╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝

  </pre>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/🔭-VEILLEUR-8B5CF6?style=for-the-badge&labelColor=1a1a2e" alt="Veilleur"/>
</p>

<h1 align="center">Veilleur</h1>

<p align="center">
  <strong>Votre sentinelle de l'information</strong>
</p>

<p align="center">
  <a href="https://news.nethttp.net">Démo</a> •
  <a href="#-fonctionnalités">Fonctionnalités</a> •
  <a href="#-démarrage-rapide">Démarrage</a> •
  <a href="#-déploiement">Déploiement</a> •
  <a href="#-stack-technique">Stack</a> •
  <a href="#-documentation">Documentation</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22_LTS-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Fastify-5.x-000000?style=flat-square&logo=fastify&logoColor=white" alt="Fastify"/>
  <img src="https://img.shields.io/badge/MariaDB-11.x-003545?style=flat-square&logo=mariadb&logoColor=white" alt="MariaDB"/>
  <img src="https://img.shields.io/badge/Redis-7.x-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis"/>
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker"/>
  <a href="https://news.nethttp.net"><img src="https://img.shields.io/badge/En_ligne-news.nethttp.net-8B5CF6?style=flat-square&logo=rss&logoColor=white" alt="En ligne"/></a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/yrbane/veilleur?style=flat-square&color=green" alt="License"/>
  <img src="https://img.shields.io/github/issues/yrbane/veilleur?style=flat-square&color=yellow" alt="Issues"/>
  <img src="https://img.shields.io/badge/TDD-First-FF6B6B?style=flat-square" alt="TDD First"/>
  <img src="https://img.shields.io/badge/Lang-Français-blue?style=flat-square" alt="Français"/>
</p>

---

## 📖 À propos

**Veilleur** est un agrégateur d'actualités libre et open source. Ajoutez vos sources RSS et sites web favoris, personnalisez votre fil d'actualités, et découvrez de nouvelles sources via la communauté.

> *« Restez informé, simplement. »*

---

## ✨ Fonctionnalités

<table>
<tr>
<td width="50%">

### 📰 Agrégation
- Ajout de sources RSS et sites web : collez l'adresse du site (`mediapart.fr`), le flux et le protocole sont détectés automatiquement
- Favicon et tags de la source récupérés automatiquement à l'ajout (catégories du flux, mots-clés du site) ; favicons mis en cache et servis par Veilleur, le navigateur ne contacte jamais les sites sources
- Extraction des métadonnées (Open Graph, Twitter Cards)

### 🎯 Personnalisation
- Notation des sources (1-5 étoiles)
- Fil en liste ou en tuiles (grille fluide), au choix et mémorisé ; mise en page pleine largeur
- Barre de commandes compacte (recherche, tri, panneau de filtres, bascules) et rail dépliable des rubriques, tendances et mots-clés
- Tags de sources déduits automatiquement, modifiables à la main ; ils forment les rubriques du fil, avec le compte de non-lus. Chaque tag porte une couleur stable dérivée de son nom (roue de teintes oklch harmonisée avec le thème, clair et sombre)
- Articles notés et mis en favoris, classés automatiquement par cinq mots-clés extraits du texte
- Fil trié (date, note, titre, source), filtré par source, période, note, favoris, liste de lecture, non lus et mots-clés, avec chargement au défilement
- Recherche plein texte avec exclusions (`-mot`), phrases exactes et préfixes, termes surlignés dans les cartes
- Lu / non lu : lecture automatique à l'ouverture, filtre « Non lus », compteurs par source, « Tout marquer lu »
- Lecture en place : le contenu de l'article, extrait et nettoyé côté serveur, s'ouvre dans une fenêtre sans quitter le fil
- Liste de lecture « à lire plus tard » et export de toutes les annotations en JSON ou CSV
- Paramètres avancés par source
- Paramètres en pleine largeur avec navigation latérale : compte, sécurité (mot de passe, 2FA), notifications, application et données
- Thème clair, sombre ou automatique en un clic dans l'en-tête, mémorisé dans le navigateur
- Raccourci `/` vers la recherche, retour en haut du fil, navigation compacte sur mobile

</td>
<td width="50%">

### 🌐 Communauté
- Découverte de sources populaires
- Mots-clés tendance (24 h contre 7 jours) sur le fil et sur toute la plateforme
- Filtrage par tags
- Notes moyennes communautaires
- Articles les plus appréciés de la semaine, suggestions de sources d'après les lecteurs aux goûts proches, partage d'articles

### 📱 Application installable
- PWA : manifeste, icônes, raccourcis, coque consultable hors ligne, installation depuis les paramètres

### 🔔 Notifications
- Web Push après chaque synchronisation (regroupé, au plus une fois par demi-heure, réglable par source)
- Résumé courriel quotidien ou hebdomadaire des articles non lus, groupé par source

### 🏅 Parcours
- Points, six niveaux, douze badges et série de jours de lecture, déduits de votre activité
- Classement public sur la base du volontariat, sous pseudo

### 🛡️ Administration
- Dans les Paramètres, un groupe « Administration » réservé aux administrateurs : statistiques anonymes et graphiques sur 30 jours, gestion des comptes (rôle, désactivation, suppression) et des sources (synchronisation, statut) dans des tables triables, état du système (Redis, base, files)
- Le premier compte de l'instance est administrateur ; `npm run admin:promouvoir:prod -- <email>` en promeut un autre

### ⚡ Performance
- Cache agressif (90% hit rate)
- Réponses < 200ms (p95)
- 1000 utilisateurs simultanés

</td>
</tr>
</table>

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Client["🖥️ Client"]
        WC[Web Components]
        CSS[Lunar Aurora + CSS moderne]
        Icones[Material Symbols]
    end

    subgraph API["⚡ API Fastify"]
        Routes[Routes]
        MW[Middlewares]
        Auth[JWT Auth]
    end

    subgraph Domaine["🎯 Domaine"]
        Services[Services]
        Entites[Entités]
    end

    subgraph Infra["🔧 Infrastructure"]
        Scraping[Scraping]
        Cache[Cache]
        BDD[Base de données]
    end

    subgraph External["☁️ Externe"]
        RSS[Sources RSS]
        Sites[Sites Web]
    end

    Client --> API
    API --> Domaine
    Domaine --> Infra
    Scraping --> External

    subgraph Storage["💾 Stockage"]
        MariaDB[(MariaDB)]
        Redis[(Redis)]
    end

    BDD --> MariaDB
    Cache --> Redis
```

---

## 🚀 Démarrage Rapide

### Avec Docker (Recommandé)

```bash
# 1. Cloner le projet
git clone https://github.com/yrbane/veilleur.git
cd veilleur

# 2. Configurer et démarrer
cp .env.example .env
make dev
```

<p align="center">
  <img src="https://img.shields.io/badge/App-localhost:3000-8B5CF6?style=for-the-badge" alt="App"/>
  <img src="https://img.shields.io/badge/Adminer-localhost:8080-4A90D9?style=for-the-badge" alt="Adminer"/>
  <img src="https://img.shields.io/badge/Redis_UI-localhost:8081-DC382D?style=for-the-badge" alt="Redis"/>
</p>

### 📋 Commandes Make

| Commande | Description |
|:---------|:------------|
| `make dev` | 🟢 Démarrer l'environnement |
| `make down` | 🔴 Arrêter les conteneurs |
| `make logs` | 📜 Voir les logs |
| `make shell` | 💻 Shell dans l'app |
| `make db-shell` | 🗄️ Shell MariaDB |
| `make test` | 🧪 Lancer les tests |
| `make debug` | 🔧 Avec outils admin |
| `make help` | ❓ Toutes les commandes |

### Sans Docker

```bash
git clone https://github.com/yrbane/veilleur.git
cd veilleur
npm install
cp .env.example .env
# Configurer MariaDB et Redis localement
npm run db:migrate
npm run db:seed      # sources par défaut (optionnel)
npm run dev
```

### Build de production

```bash
npm run build        # typecheck + bundle serveur (esbuild) + client (Vite)
npm run db:migrate:prod   # migrations via dist/migrer.js (sans drizzle-kit)
npm start            # node dist/serveur.js — API + workers + frontend sur :8080
```

Le bundle esbuild (`scripts/build-serveur.mjs`) résout les alias `@/` et produit
`dist/serveur.js`, `dist/migrer.js` et `dist/seed.js`, exécutables directement par Node.

---

## 🛠️ Stack Technique

```mermaid
mindmap
  root((Veilleur))
    Backend
      Node.js 22 LTS
      Fastify 5.x
      TypeScript 5.7+
      Drizzle ORM
      BullMQ
    Frontend
      Vanilla TS
      Web Components
      Lunar Aurora
        Tokens oklch
        Thèmes clair/sombre
        Layers CSS
      Material Symbols
    Stockage
      MariaDB 11.x
      Redis 7.x
    Tests
      Vitest
      Playwright
    Scraping
      cheerio
      rss-parser
```

### Détail des technologies

<table>
<tr>
<th>Catégorie</th>
<th>Technologie</th>
<th>Rôle</th>
</tr>
<tr>
<td rowspan="5">🔙 Backend</td>
<td><img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white"/></td>
<td>Runtime JavaScript</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Fastify-000000?style=flat-square&logo=fastify&logoColor=white"/></td>
<td>Framework web performant</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white"/></td>
<td>Typage statique</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Drizzle-C5F74F?style=flat-square&logo=drizzle&logoColor=black"/></td>
<td>ORM type-safe</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/BullMQ-E34F26?style=flat-square"/></td>
<td>File de tâches Redis</td>
</tr>
<tr>
<td rowspan="4">🎨 Frontend</td>
<td><img src="https://img.shields.io/badge/Web_Components-29ABE2?style=flat-square&logo=webcomponents.org&logoColor=white"/></td>
<td>Composants natifs</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Lunar_Aurora-7C3AED?style=flat-square&logo=css3&logoColor=white"/></td>
<td>Framework CSS (tokens oklch, thèmes, composants)</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Material_Symbols-4285F4?style=flat-square&logo=google&logoColor=white"/></td>
<td>Icônes, police auto-hébergée</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white"/></td>
<td>Build tool</td>
</tr>
<tr>
<td rowspan="2">💾 Stockage</td>
<td><img src="https://img.shields.io/badge/MariaDB-003545?style=flat-square&logo=mariadb&logoColor=white"/></td>
<td>Base de données relationnelle</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white"/></td>
<td>Cache et sessions</td>
</tr>
<tr>
<td rowspan="2">🧪 Tests</td>
<td><img src="https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white"/></td>
<td>Tests unitaires</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white"/></td>
<td>Tests E2E</td>
</tr>
<tr>
<td rowspan="2">🔍 Scraping</td>
<td><img src="https://img.shields.io/badge/cheerio-E88C1F?style=flat-square"/></td>
<td>Parsing HTML</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/rss--parser-FF6600?style=flat-square"/></td>
<td>Parsing RSS/Atom</td>
</tr>
</table>

---

## 🐳 Docker

### Services

```mermaid
graph LR
    subgraph Docker["🐳 Docker Compose"]
        App["📦 veilleur-app<br/>Node.js 22"]
        DB["🗄️ veilleur-mariadb<br/>MariaDB 11"]
        Cache["⚡ veilleur-redis<br/>Redis 7"]

        App --> DB
        App --> Cache
    end

    subgraph Debug["🔧 Debug (optionnel)"]
        Adminer["🔍 Adminer<br/>:8080"]
        RedisUI["📊 Redis Commander<br/>:8081"]
    end

    DB -.-> Adminer
    Cache -.-> RedisUI
```

### Volumes persistants

| Volume | Contenu |
|:-------|:--------|
| `veilleur-mariadb-data` | Données MariaDB |
| `veilleur-redis-data` | Données Redis (AOF) |

---

## 🚀 Déploiement

L'instance publique tourne sur **https://news.nethttp.net** (Debian 13, sans Docker :
MariaDB et Redis natifs, Apache en reverse proxy derrière le pare-feu applicatif websec).

**Déploiement continu** : chaque push (merge) sur `main` déclenche le workflow
[`deploy-nethttp.yml`](.github/workflows/deploy-nethttp.yml) — lint, typecheck, tests et
build, puis rsync SSH et installation sur le serveur (secrets `NETHTTP_SSH_KEY` et
`NETHTTP_KNOWN_HOSTS`). Les pull requests n'exécutent que la vérification.

Déploiement manuel, même résultat :

```bash
npm run deploy:nethttp
```

Le script `scripts/deploy-nethttp.sh` construit l'application, envoie `dist/`, les
migrations et les manifestes par rsync, puis exécute `deploy/nethttp/installer.sh`
en root sur le serveur. Cet installeur est **idempotent** :

| Étape | Premier passage | Passages suivants |
|:------|:----------------|:------------------|
| Node 22 LTS dans `/opt/nodejs` | téléchargé, somme SHA-256 vérifiée | conservé |
| Utilisateur système `veilleur` | créé | conservé |
| `/var/www/nethttp.net/news/.env` | généré (mot de passe BDD, secrets JWT) | jamais écrasé |
| Base MariaDB `veilleur` | créée | mot de passe resynchronisé |
| Code + `npm ci --omit=dev` | installé | mis à jour |
| Migrations Drizzle | appliquées | appliquées |
| Sources par défaut | insérées | ignorées (`.seed-fait`) |
| Service systemd `veilleur` | installé, activé | redémarré |
| Vhost Apache `015-news.nethttp.net.conf` | activé | rechargé |

Fichiers : `deploy/nethttp/veilleur.service` (service durci, seul `data/images` est
inscriptible), `deploy/nethttp/015-news.nethttp.net.conf` (proxy vers `127.0.0.1:8090`),
`deploy/nethttp/env.production` (modèle d'environnement).

Migrations et sources par défaut tournent via `systemd-run` avec le même
`EnvironmentFile` que le service : le `.env` suit la syntaxe systemd, et toute
valeur contenant un espace, une parenthèse ou un chevron (`SCRAPING_USER_AGENT`,
`SMTP_FROM`) doit être entre guillemets doubles.

```bash
ssh nethttp 'journalctl -u veilleur -n 100 -f'   # logs
ssh nethttp 'sudo systemctl status veilleur'      # état du service
```

---

## 📚 Documentation

| Document | Description |
|:---------|:------------|
| 📋 [Spécification](./specs/001-agregateur-actualites/spec.md) | User stories et exigences |
| 🗺️ [Plan](./specs/001-agregateur-actualites/plan.md) | Plan d'implémentation |
| 📊 [Data Model](./specs/001-agregateur-actualites/data-model.md) | Schéma de données |
| 🔌 [API](./specs/001-agregateur-actualites/contracts/api.yaml) | Contrat OpenAPI |
| 🔬 [Recherche](./specs/001-agregateur-actualites/research.md) | Choix techniques |
| 🚀 [Quickstart](./specs/001-agregateur-actualites/quickstart.md) | Guide de démarrage |
| ✅ [Tâches](./specs/001-agregateur-actualites/tasks.md) | 101 tâches à réaliser |

---

## 📈 Roadmap

```mermaid
gantt
    title Milestones Veilleur
    dateFormat  YYYY-MM-DD
    section MVP
    Le Réveil du Veilleur (Setup)       :m1, 2025-01-01, 3d
    Les Yeux Grands Ouverts (Fondations):m2, after m1, 5d
    Première Veille (US1 Sources)       :m3, after m2, 4d
    Le Fil de l'Info (US2 Articles)     :m4, after m3, 3d
    section Features
    Identité Secrète (US5 Compte)       :m5, after m4, 2d
    Les Étoiles du Veilleur (US3 Notes) :m6, after m5, 3d
    Ajustements Nocturnes (US6 Params)  :m7, after m6, 3d
    Communauté des Veilleurs (US4)      :m8, after m7, 3d
    section Polish
    Le Grand Polish                      :m9, after m8, 3d
```

---

## 🎯 Principes

<table>
<tr>
<td align="center" width="14%">
<img src="https://img.shields.io/badge/1-TDD_First-FF6B6B?style=for-the-badge"/>
<br/><sub>Tests avant code</sub>
</td>
<td align="center" width="14%">
<img src="https://img.shields.io/badge/2-Sécurité-4ECDC4?style=for-the-badge"/>
<br/><sub>Security by design</sub>
</td>
<td align="center" width="14%">
<img src="https://img.shields.io/badge/3-Performance-45B7D1?style=for-the-badge"/>
<br/><sub>Cache agressif</sub>
</td>
<td align="center" width="14%">
<img src="https://img.shields.io/badge/4-SOLID-96CEB4?style=for-the-badge"/>
<br/><sub>Code propre</sub>
</td>
<td align="center" width="14%">
<img src="https://img.shields.io/badge/5-UX-DDA0DD?style=for-the-badge"/>
<br/><sub>Ergonomie</sub>
</td>
<td align="center" width="14%">
<img src="https://img.shields.io/badge/6-FR-3B82F6?style=for-the-badge"/>
<br/><sub>Tout en français</sub>
</td>
<td align="center" width="14%">
<img src="https://img.shields.io/badge/7-Harmonie-8B5CF6?style=for-the-badge"/>
<br/><sub>Beauté du code</sub>
</td>
</tr>
</table>

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Consultez les [issues](https://github.com/yrbane/veilleur/issues) pour voir les tâches disponibles.

```bash
# Fork et clone
git clone https://github.com/votre-user/veilleur.git

# Créer une branche
git checkout -b feature/ma-fonctionnalite

# Développer avec TDD
make test-watch

# Push et PR
git push origin feature/ma-fonctionnalite
```

---

## 📄 Licence

<p align="center">
  <img src="https://img.shields.io/badge/Licence-MIT-green?style=for-the-badge" alt="MIT License"/>
</p>

---

<p align="center">
  <sub>Fait avec ❤️ par la communauté</sub>
</p>

<p align="center">
  <a href="https://github.com/yrbane/veilleur">
    <img src="https://img.shields.io/badge/⭐_Star_this_repo-8B5CF6?style=for-the-badge" alt="Star"/>
  </a>
</p>
