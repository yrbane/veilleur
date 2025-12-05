# Guide de Démarrage Rapide

**Projet** : **Veilleur** - Votre sentinelle de l'information
**Repository** : https://github.com/yrbane/veilleur
**Date** : 2025-12-05

## Prérequis

| Outil | Version | Vérification |
|-------|---------|--------------|
| Node.js | 22 LTS | `node --version` |
| npm | 10+ | `npm --version` |
| MariaDB | 11.x | `mariadb --version` |
| Redis | 7.x | `redis-cli --version` |

## Installation

### 1. Cloner le projet

```bash
git clone https://github.com/yrbane/veilleur.git
cd veilleur
git checkout 001-agregateur-actualites
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer l'environnement

```bash
cp .env.example .env
```

Modifier `.env` :

```env
# Base de données
DATABASE_URL=mysql://utilisateur:motdepasse@localhost:3306/news

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=votre-secret-tres-long-et-aleatoire
JWT_REFRESH_SECRET=autre-secret-pour-refresh-tokens

# Serveur
PORT=3000
NODE_ENV=development

# Scraping
SCRAPING_USER_AGENT=NewsAggregator/1.0 (+https://github.com/votre-repo)
SCRAPING_RATE_LIMIT_MS=5000
```

### 4. Créer la base de données

```bash
# Se connecter à MariaDB
mariadb -u root -p

# Créer la base et l'utilisateur
CREATE DATABASE news CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'news'@'localhost' IDENTIFIED BY 'motdepasse';
GRANT ALL PRIVILEGES ON news.* TO 'news'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 5. Appliquer les migrations

```bash
npm run db:migrate
```

### 6. Démarrer Redis

```bash
# Linux/macOS
redis-server

# Ou avec Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### 7. Lancer le serveur de développement

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3000`.

---

## Commandes Disponibles

### Développement

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement (hot reload) |
| `npm run build` | Build de production |
| `npm run start` | Démarrer en production |

### Base de Données

| Commande | Description |
|----------|-------------|
| `npm run db:generate` | Générer une migration |
| `npm run db:migrate` | Appliquer les migrations |
| `npm run db:studio` | Interface Drizzle Studio |
| `npm run db:push` | Push schema (dev only) |

### Tests

| Commande | Description |
|----------|-------------|
| `npm run test` | Tests unitaires (watch) |
| `npm run test:run` | Tests unitaires (single run) |
| `npm run test:ui` | Interface Vitest UI |
| `npm run test:coverage` | Couverture de code |
| `npm run test:e2e` | Tests E2E Playwright |

### Qualité

| Commande | Description |
|----------|-------------|
| `npm run lint` | Vérifier le code |
| `npm run lint:fix` | Corriger automatiquement |
| `npm run format` | Formater avec Prettier |
| `npm run typecheck` | Vérifier les types |

---

## Structure des Fichiers

```
news/
├── src/
│   ├── domaine/           # Logique métier
│   ├── infrastructure/    # Accès aux données
│   ├── api/               # Routes Fastify
│   └── client/            # Frontend vanilla
├── tests/
│   ├── unitaires/
│   ├── integration/
│   └── e2e/
├── specs/                 # Documentation
└── drizzle/               # Migrations
```

---

## Tester l'API

### Inscription

```bash
curl -X POST http://localhost:3000/api/v1/auth/inscription \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "motDePasse": "MotDePasse123"}'
```

### Connexion

```bash
curl -X POST http://localhost:3000/api/v1/auth/connexion \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "motDePasse": "MotDePasse123"}'
```

### Ajouter une source

```bash
curl -X POST http://localhost:3000/api/v1/sources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <votre-token>" \
  -d '{"url": "https://www.lemonde.fr/rss/une.xml"}'
```

### Obtenir le fil d'actualités

```bash
curl http://localhost:3000/api/v1/articles \
  -H "Authorization: Bearer <votre-token>"
```

---

## Workflow TDD

Le projet suit strictement le TDD. Pour chaque fonctionnalité :

### 1. Écrire le test (Rouge)

```typescript
// tests/unitaires/domaine/ServiceSources.test.ts
import { describe, it, expect } from 'vitest';
import { ServiceSources } from '@/domaine/services/ServiceSources';

describe('ServiceSources', () => {
  describe('ajouterSource', () => {
    it('doit ajouter une source RSS valide', async () => {
      const service = new ServiceSources(/* dépendances mockées */);

      const resultat = await service.ajouterSource({
        utilisateurId: 'user-123',
        url: 'https://example.com/feed.xml'
      });

      expect(resultat.nom).toBeDefined();
      expect(resultat.typeSource).toBe('rss');
    });
  });
});
```

### 2. Vérifier l'échec

```bash
npm run test -- ServiceSources
# ❌ Le test doit échouer
```

### 3. Implémenter (Vert)

```typescript
// src/domaine/services/ServiceSources.ts
export class ServiceSources {
  async ajouterSource(requete: AjoutSourceRequete): Promise<Source> {
    // Implémentation minimale pour passer le test
  }
}
```

### 4. Vérifier le succès

```bash
npm run test -- ServiceSources
# ✅ Le test doit passer
```

### 5. Refactoriser

Améliorer le code tout en gardant les tests au vert.

---

## Dépannage

### Erreur de connexion MariaDB

```
Error: Access denied for user 'news'@'localhost'
```

**Solution** : Vérifier les credentials dans `.env` et les privilèges MySQL.

### Erreur de connexion Redis

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution** : Démarrer Redis (`redis-server` ou `docker run -d -p 6379:6379 redis:7-alpine`).

### Erreur de migration

```
Error: relation "xxx" already exists
```

**Solution** : Réinitialiser la base de données :

```bash
npm run db:push -- --force
```

### Port déjà utilisé

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution** : Changer le port dans `.env` ou tuer le processus existant :

```bash
lsof -i :3000
kill -9 <PID>
```

---

## Prochaines Étapes

1. Exécuter `/speckit.tasks` pour générer la liste des tâches
2. Commencer par les tests de la Story 1 (Ajouter une source)
3. Implémenter en suivant le workflow TDD
4. Valider avec `npm run test && npm run lint && npm run typecheck`
