# Veilleur

**Votre sentinelle de l'information**

Agrégateur d'actualités libre et open source. Ajoutez vos sources RSS et sites web favoris, personnalisez votre fil d'actualités, et découvrez de nouvelles sources via la communauté.

## Fonctionnalités

- Ajout de sources RSS et sites web (détection automatique)
- Fil d'actualités unifié avec articles enrichis (titre, résumé, image, métadonnées)
- Notation et tags personnalisés par source
- Découverte de sources populaires via la communauté
- Paramètres avancés par source (fréquence, rétention, filtres, priorité)
- Cache agressif pour des performances optimales
- Interface moderne et responsive

## Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Backend | Node.js 22 LTS, Fastify 5.x, TypeScript |
| Base de données | MariaDB 11.x |
| Cache | Redis 7.x (ioredis) |
| ORM | Drizzle ORM |
| Jobs | BullMQ |
| Frontend | Vanilla TypeScript, Web Components |
| Styles | CSS moderne (nesting, oklch, container queries) |
| Tests | Vitest, Playwright |
| Scraping | cheerio, rss-parser |

## Démarrage Rapide

```bash
# Cloner le projet
git clone https://github.com/yrbane/veilleur.git
cd veilleur

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env

# Appliquer les migrations
npm run db:migrate

# Lancer le serveur de développement
npm run dev
```

Voir le [Guide de Démarrage Complet](./specs/001-agregateur-actualites/quickstart.md) pour plus de détails.

## Documentation

- [Spécification](./specs/001-agregateur-actualites/spec.md)
- [Plan d'implémentation](./specs/001-agregateur-actualites/plan.md)
- [Modèle de données](./specs/001-agregateur-actualites/data-model.md)
- [Contrat API](./specs/001-agregateur-actualites/contracts/api.yaml)
- [Recherche technique](./specs/001-agregateur-actualites/research.md)

## Principes

Ce projet suit une constitution stricte :

1. **TDD First** - Tests avant le code, toujours
2. **Sécurité** - Sécurité intégrée dès la conception
3. **Performance** - Cache agressif, réponses < 200ms
4. **Code SOLID** - Architecture propre et maintenable
5. **Ergonomie** - Interface intuitive et accessible
6. **Français** - Code, commentaires et UI en français
7. **Harmonie** - Code et design beaux et cohérents

## Licence

MIT

---

*Veilleur - Restez informé, simplement.*
