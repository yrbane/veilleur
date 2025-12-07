/**
 * Veilleur - Middleware de préchargement HTTP/2
 * Ajoute les headers Link pour le préchargement des ressources
 *
 * HTTP/2 Server Push via Link headers permet au navigateur
 * de commencer à télécharger les ressources critiques
 * avant même d'analyser le HTML.
 *
 * Fonctionnalités:
 * - Préchargement automatique des assets critiques
 * - Support des différents types de ressources (script, style, font, image)
 * - Gestion du crossorigin pour les fonts
 * - Configuration par route
 */

/**
 * Interface simplifiée pour Request Express
 */
interface Request {
  path: string;
}

/**
 * Interface simplifiée pour Response Express
 */
interface Response {
  setHeader(name: string, value: string | string[]): void;
  getHeader(name: string): string | string[] | number | undefined;
  json: (body: unknown) => Response;
  writeEarlyHints?: (hints: { link: string }) => void;
}

/**
 * Type pour NextFunction Express
 */
type NextFunction = () => void;

/**
 * Types de ressources supportés pour le préchargement
 */
export type TypeRessource = 'script' | 'style' | 'font' | 'image' | 'fetch' | 'document';

/**
 * Configuration d'une ressource à précharger
 */
export interface RessourcePreload {
  href: string;
  as: TypeRessource;
  type?: string; // MIME type pour font, etc.
  crossorigin?: boolean | 'anonymous' | 'use-credentials';
  nopush?: boolean; // Ne pas utiliser Server Push, juste preload
}

/**
 * Configuration du middleware
 */
interface ConfigPreload {
  // Ressources à précharger sur toutes les pages
  global?: RessourcePreload[];
  // Ressources par route (pattern -> ressources)
  parRoute?: Record<string, RessourcePreload[]>;
  // Activer le préchargement automatique basé sur l'accept header
  autoPreload?: boolean;
}

/**
 * Configuration par défaut
 */
const CONFIG_DEFAUT: ConfigPreload = {
  global: [],
  parRoute: {},
  autoPreload: true,
};

/**
 * Génère une directive Link pour une ressource
 */
function genererLinkHeader(ressource: RessourcePreload): string {
  const parts = [`<${ressource.href}>`, 'rel=preload', `as=${ressource.as}`];

  if (ressource.type) {
    parts.push(`type="${ressource.type}"`);
  }

  if (ressource.crossorigin) {
    if (ressource.crossorigin === true || ressource.crossorigin === 'anonymous') {
      parts.push('crossorigin');
    } else {
      parts.push(`crossorigin=${ressource.crossorigin}`);
    }
  }

  if (ressource.nopush) {
    parts.push('nopush');
  }

  return parts.join('; ');
}

/**
 * Middleware de préchargement
 */
export function preload(config?: ConfigPreload) {
  const cfg = { ...CONFIG_DEFAUT, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    const ressources: RessourcePreload[] = [...(cfg.global ?? [])];

    // Ajouter les ressources spécifiques à la route
    if (cfg.parRoute) {
      for (const [pattern, routeRessources] of Object.entries(cfg.parRoute)) {
        if (new RegExp(pattern).test(req.path)) {
          ressources.push(...routeRessources);
        }
      }
    }

    // Générer les headers Link
    if (ressources.length > 0) {
      const linkHeaders = ressources.map(genererLinkHeader);
      res.setHeader('Link', linkHeaders.join(', '));
    }

    next();
  };
}

/**
 * Assets communs pour le frontend
 */
export const ASSETS_COMMUNS: RessourcePreload[] = [
  // CSS principal (sera ajusté selon la config Vite)
  {
    href: '/assets/css/main.css',
    as: 'style',
  },
  // JS principal
  {
    href: '/assets/js/main.js',
    as: 'script',
  },
];

/**
 * Fonts communes à précharger
 */
export const FONTS_COMMUNES: RessourcePreload[] = [
  {
    href: '/fonts/inter-var.woff2',
    as: 'font',
    type: 'font/woff2',
    crossorigin: true,
  },
];

/**
 * Helper pour précharger les images critiques
 */
export function preloadImages(...urls: string[]): RessourcePreload[] {
  return urls.map(href => ({
    href,
    as: 'image' as TypeRessource,
    nopush: true, // Images souvent trop grosses pour push
  }));
}

/**
 * Middleware pour les API qui retournent des données avec assets liés
 */
export function preloadApiAssets(extracteurAssets: (req: Request) => string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Sauvegarder la fonction json originale
    const jsonOriginal = res.json.bind(res);

    // Surcharger res.json pour ajouter les headers avant l'envoi
    res.json = function (body: unknown): Response {
      try {
        const assets = extracteurAssets(req);
        if (assets.length > 0) {
          const linkHeaders = assets.map(href => `<${href}>; rel=preload; as=image; nopush`);
          const existingLink = res.getHeader('Link');
          const allLinks = existingLink
            ? `${existingLink}, ${linkHeaders.join(', ')}`
            : linkHeaders.join(', ');
          res.setHeader('Link', allLinks);
        }
      } catch {
        // Ignorer les erreurs d'extraction
      }

      return jsonOriginal(body);
    };

    next();
  };
}

/**
 * Ajoute dynamiquement une ressource à précharger
 */
export function ajouterPreload(
  res: Response,
  ressource: RessourcePreload,
): void {
  const linkHeader = genererLinkHeader(ressource);
  const existingLink = res.getHeader('Link');

  if (existingLink) {
    res.setHeader('Link', `${existingLink}, ${linkHeader}`);
  } else {
    res.setHeader('Link', linkHeader);
  }
}

/**
 * Middleware pour les pages HTML avec injection d'assets critiques
 */
export function preloadPourHtml(assets: RessourcePreload[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // Ajouter tous les assets critiques
    assets.forEach(asset => ajouterPreload(res, asset));

    // Header pour indiquer le support HTTP/2 Push
    res.setHeader('Supports-Loading-Mode', 'fenced-frame');

    next();
  };
}

/**
 * Génère les balises link preload pour le HTML
 * (pour l'injection SSR ou dans index.html)
 */
export function genererPreloadHtml(ressources: RessourcePreload[]): string {
  return ressources
    .map(r => {
      let attrs = `href="${r.href}" rel="preload" as="${r.as}"`;
      if (r.type) attrs += ` type="${r.type}"`;
      if (r.crossorigin) attrs += ' crossorigin';
      return `<link ${attrs}>`;
    })
    .join('\n    ');
}

/**
 * Early hints (103) helper
 * Note: Requiert un serveur supportant HTTP/2 et early hints
 */
export function envoyerEarlyHints(res: Response, ressources: RessourcePreload[]): void {
  const links = ressources.map(r => {
    let link = `<${r.href}>; rel=preload; as=${r.as}`;
    if (r.crossorigin) link += '; crossorigin';
    return link;
  });

  // writeEarlyHints est disponible sur Node 18.11+
  if (typeof res.writeEarlyHints === 'function') {
    res.writeEarlyHints({
      link: links.join(', '),
    });
  }
}
