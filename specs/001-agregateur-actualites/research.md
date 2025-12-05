# Recherche : Agrégateur d'Actualités Libre

**Date** : 2025-12-05
**Branche** : `001-agregateur-actualites`

## 1. Parsing RSS/Atom

### Décision
Utiliser `rss-parser` pour le parsing des flux RSS/Atom.

### Justification
- Bibliothèque TypeScript native, bien typée
- Supporte RSS 2.0, RSS 1.0, Atom 1.0
- Gestion automatique des encodages
- API simple et asynchrone
- Maintenance active (>1M téléchargements/semaine)

### Alternatives Considérées
| Alternative | Rejetée car |
|-------------|-------------|
| feedparser (Python) | Nécessite un service séparé |
| xml2js + parsing manuel | Plus de code à maintenir, erreurs potentielles |
| fast-xml-parser | Moins spécialisé RSS, plus de travail |

---

## 2. Scraping HTML & Extraction Métadonnées

### Décision
Utiliser `cheerio` pour le parsing HTML et l'extraction des métadonnées.

### Justification
- API jQuery-like, familière et productive
- Très performant (pas de navigateur headless)
- Parfait pour extraction statique (Open Graph, Twitter Cards)
- Léger (~1MB)

### Alternatives Considérées
| Alternative | Rejetée car |
|-------------|-------------|
| Puppeteer/Playwright | Trop lourd pour du scraping simple, ressources excessives |
| jsdom | Plus lent que cheerio, API moins intuitive |
| linkedom | Moins mature, communauté plus petite |

---

## 3. Client HTTP

### Décision
Utiliser `undici` (intégré Node.js 22) pour les requêtes HTTP.

### Justification
- Intégré à Node.js 22 LTS (fetch natif)
- Performance supérieure à node-fetch et axios
- Support HTTP/2
- Pool de connexions automatique

### Alternatives Considérées
| Alternative | Rejetée car |
|-------------|-------------|
| axios | Dépendance externe, moins performant |
| node-fetch | Déprécié au profit de fetch natif |
| got | Dépendance supplémentaire non nécessaire |

---

## 4. Cache Redis

### Décision
Utiliser `ioredis` comme client Redis.

### Justification
- Support complet des commandes Redis
- Clustering et Sentinel natifs
- Reconnexion automatique
- Pipelines et transactions
- TypeScript natif

### Alternatives Considérées
| Alternative | Rejetée car |
|-------------|-------------|
| redis (node-redis) | API moins ergonomique, moins de features |
| keyv | Abstraction trop générique pour nos besoins |

### Stratégie de Cache
```
Clé: source:{sourceId}:articles
TTL: Selon paramètres source (défaut 30 min)
Invalidation: À chaque rafraîchissement réussi

Clé: article:{articleId}:metadonnees
TTL: 24 heures (métadonnées stables)
Invalidation: Jamais (données immuables)

Clé: utilisateur:{userId}:fil
TTL: 5 minutes
Invalidation: Ajout/suppression source
```

---

## 5. ORM et Base de Données

### Décision
Utiliser `Drizzle ORM` avec MariaDB.

### Justification
- SQL-like, pas d'abstraction magique
- Type-safe sans génération de code
- Migrations en TypeScript
- Performances proches du SQL brut
- Support MariaDB natif

### Alternatives Considérées
| Alternative | Rejetée car |
|-------------|-------------|
| Prisma | Génération de code, moins de contrôle SQL |
| TypeORM | Patterns Active Record, moins SOLID |
| Kysely | Moins mature, communauté plus petite |
| SQL brut | Moins maintenable, pas de migrations |

---

## 6. Authentification

### Décision
JWT (JSON Web Tokens) avec refresh tokens.

### Justification
- Stateless, scalable horizontalement
- Standard industrie bien documenté
- Intégration facile avec Fastify (@fastify/jwt)
- Pas de session côté serveur

### Implémentation
```
Access Token: 15 minutes, signé HS256
Refresh Token: 7 jours, stocké en BDD
Rotation: Nouveau refresh à chaque utilisation
Révocation: Blacklist en Redis (TTL = durée restante)
```

### Alternatives Considérées
| Alternative | Rejetée car |
|-------------|-------------|
| Sessions cookie | Nécessite stockage serveur, moins scalable |
| OAuth2 only | Trop complexe pour MVP, ajout futur possible |
| Passport.js | Abstraction inutile pour notre cas simple |

---

## 7. Détection de Doublons

### Décision
Combinaison URL canonique + similarité titre (Levenshtein).

### Justification
- URL canonique : détection exacte rapide
- Similarité titre : gère les republications
- Seuil de 85% pour éviter faux positifs

### Algorithme
```
1. Normaliser URL (retirer paramètres tracking, www, protocole)
2. Hash MD5 de l'URL normalisée
3. Si hash existe → doublon certain
4. Sinon, calculer similarité titre avec articles récents
5. Si similarité > 85% → doublon probable, fusionner
```

### Alternatives Considérées
| Alternative | Rejetée car |
|-------------|-------------|
| Hash contenu complet | Trop coûteux, contenu pas toujours disponible |
| SimHash | Plus complexe, marginal gain pour notre échelle |
| Elasticsearch | Overkill pour 1000 utilisateurs |

---

## 8. Rate Limiting Scraping

### Décision
Système de tokens par domaine avec backoff exponentiel.

### Justification
- Respecte les serveurs sources
- Adaptatif aux réponses (429, 503)
- Configurable par source

### Implémentation
```
Défaut: 1 requête / 5 secondes / domaine
Sur 429: Backoff x2 (max 5 minutes)
Sur 503: Pause 1 minute, retry
Sur succès après erreur: Reset progressif

Stockage: Redis (tokens par domaine)
```

---

## 9. Architecture Frontend Vanilla

### Décision
Web Components natifs + routeur léger personnalisé.

### Justification
- Zéro dépendance framework
- Standards web, pérenne
- Performance optimale (pas de virtual DOM)
- Encapsulation Shadow DOM

### Structure Composants
```typescript
// Exemple: CarteArticle.ts
class CarteArticle extends HTMLElement {
  static observedAttributes = ['titre', 'date', 'image'];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    // Template avec styles encapsulés
  }
}

customElements.define('carte-article', CarteArticle);
```

### Alternatives Considérées
| Alternative | Rejetée car |
|-------------|-------------|
| Lit | Dépendance supplémentaire non nécessaire |
| Stencil | Trop orienté design system |
| Alpine.js | Moins de contrôle, moins SOLID |

---

## 10. CSS Moderne

### Décision
CSS natif avec fonctionnalités 2024-2025.

### Fonctionnalités Utilisées
| Feature | Usage |
|---------|-------|
| CSS Nesting | Structure SCSS-like sans préprocesseur |
| Container Queries | Responsive par composant |
| `oklch()` | Couleurs perceptuellement uniformes |
| `light-dark()` | Thèmes sans JavaScript |
| `:has()` | Sélecteur parent |
| View Transitions | Animations navigation |
| `@layer` | Cascade contrôlée |
| Subgrid | Alignement grilles imbriquées |

### Alternatives Considérées
| Alternative | Rejetée car |
|-------------|-------------|
| Tailwind | Classes utilitaires vs CSS sémantique |
| Sass/Less | Préprocesseurs obsolètes avec CSS moderne |
| CSS-in-JS | Overhead runtime, moins performant |

---

## 11. Stratégie de Tests

### Décision
Pyramide de tests avec Vitest + Playwright.

### Distribution
```
Unit (70%):     Vitest - Domaine, services, utilitaires
Integration (20%): Vitest - API routes, BDD, cache
E2E (10%):      Playwright - Parcours utilisateur critiques
```

### Couverture Cible
- Global: 80%
- Domaine: 95%
- Infrastructure: 70%
- API: 85%
- Client: 60% (E2E compense)

---

## 12. Jobs de Rafraîchissement

### Décision
BullMQ pour la gestion des jobs de scraping.

### Justification
- Basé sur Redis (déjà utilisé)
- Priorités, délais, répétitions
- Dashboard de monitoring
- TypeScript natif

### Configuration
```typescript
// Job de rafraîchissement
{
  nom: 'rafraichir-source',
  donnees: { sourceId: string },
  options: {
    priorite: 1-3,  // Selon paramètres source
    delai: 0,
    repetition: { cron: '*/30 * * * *' }, // Défaut 30 min
    tentatives: 3,
    backoff: { type: 'exponential', delai: 60000 }
  }
}
```

### Alternatives Considérées
| Alternative | Rejetée car |
|-------------|-------------|
| Agenda | MongoDB requis |
| node-cron | Pas de persistence, pas de distribution |
| Temporal | Trop complexe pour notre échelle |

---

## Résumé des Décisions

| Domaine | Choix | Confiance |
|---------|-------|-----------|
| RSS Parsing | rss-parser | Haute |
| HTML Scraping | cheerio | Haute |
| HTTP Client | undici (natif) | Haute |
| Cache | ioredis | Haute |
| ORM | Drizzle | Haute |
| Auth | JWT + refresh | Haute |
| Doublons | URL hash + Levenshtein | Moyenne |
| Rate Limiting | Token bucket + backoff | Haute |
| Frontend | Web Components | Haute |
| CSS | Natif moderne | Haute |
| Tests | Vitest + Playwright | Haute |
| Jobs | BullMQ | Haute |
