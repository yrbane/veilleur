# Repository Guidelines

## Project Structure & Modules
- `src/api/serveur.ts` : point d'entrée Fastify (API et routes de santé). Les alias TypeScript (`@/*`, `@api/*`, `@domaine/*`, etc.) sont configurés dans `tsconfig.json` pour préparer la séparation domaine/infra/client.
- `specs/001-agregateur-actualites/` : plan produit, recherche, modèle de données et quickstart fonctionnel.
- Docker/Docker Compose + `Makefile` : orchestration locale (app + MariaDB + Redis) et profils debug prod/dev.
- `dist/` est généré par `npm run build`; ne pas versionner.

## Build, Test & Dev Commands
- Local Node : `npm install`, puis `npm run dev` pour lancer l'API en watch; `npm run build` + `npm start` pour le binaire compilé.
- Docker : `make dev` (up), `make down` (stop), `make debug` (Adminer/Redis UI), `make shell` (bash dans le conteneur app).
- Qualité : `npm run lint` / `npm run lint:fix`, `npm run format`, `npm run typecheck`.
- Tests : `npm run test` (watch), `npm run test:run`, `npm run test:coverage`, `npm run test:e2e` (Playwright). Via Docker : `make test`, `make test-coverage`, `make test-e2e`.
- Base de données : `npm run db:migrate`, `npm run db:generate`, `npm run db:studio`; via Docker `make migrate`, `make db-studio`.

## Coding Style & Naming
- TypeScript strict (Node 22+). Préserver les alias `@/...` pour les imports internes. Favoriser `async/await`, retours typés, erreurs explicites.
- Formatage Prettier (2 espaces, guillemets simples) et ESLint (`eslint-config-prettier`). Ne pas désactiver les règles globalement; préférer corriger le code.
- Fichiers en `kebab-case` ou nom métier clair (`serveur.ts`), classes/interfaces en `PascalCase`, fonctions/constantes en `camelCase`.

## Testing Guidelines
- Cibler Vitest pour l'unitaire/integ (`tests/**/*.ts` attendu). E2E avec Playwright dès qu'une interface ou endpoints critiques apparaissent.
- Nommer les specs de façon explicite (`health-route.spec.ts`, `flux-rss.e2e.ts`). Exiger `npm run test:coverage` avant PR si la surface change.

## Commit & Pull Request Guidelines
- Commits courts et à l'impératif en français, centrés sur une unité de travail (ex. `Ajoute healthcheck Fastify`). Garder l'historique propre plutôt que des fix successifs.
- PR : description claire (problème/solution), commandes exécutées (`lint`, `test`, `typecheck`) et impacts infra si DB ou Docker changent. Ajouter captures/logs pour endpoints, et référencer les issues concernées.

## Configuration & Sécurité
- Dupliquer `.env.example` en `.env` et ne jamais committer de secrets. MariaDB/Redis tournent via Docker par défaut; aligner les ports si déploiement local.
- Sur production, garder `HOST`/`PORT` configurés et valider `LOG_LEVEL`. Pour tout changement ORM ou schema, générer et appliquer une migration Drizzle.
