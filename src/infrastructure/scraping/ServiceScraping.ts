/**
 * Veilleur - Service de scraping
 * Extraction d'articles depuis RSS, Atom et pages HTML
 */

import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import type { TypeSource } from '@/domaine/entites/Source';
import type { ArticleBrut, MetaOpenGraph, MetaTwitter } from '@/domaine/entites/Article';
import { env } from '@/config/environnement';
import { loggerScraping } from '../logging/logger';
import { validerUrlScraping } from './validationUrl';

/**
 * Résultat de l'extraction d'une source
 */
export interface ResultatExtraction {
  articles: ArticleBrut[];
  titre: string | null;
  favicon: string | null;
  type: TypeSource;
}

/**
 * Options de scraping
 */
export interface OptionsScraping {
  timeout?: number;
  userAgent?: string;
  maxArticles?: number;
  /** Sélecteurs CSS personnalisés pour l'extraction HTML */
  selecteursPersonnalises?: string[];
  /** Activer l'enrichissement automatique des articles */
  enrichirAutomatiquement?: boolean;
}

const OPTIONS_DEFAUT: Required<OptionsScraping> = {
  timeout: env.SCRAPING_TIMEOUT_MS,
  userAgent: env.SCRAPING_USER_AGENT,
  maxArticles: 50,
  selecteursPersonnalises: [],
  enrichirAutomatiquement: false,
};

/**
 * Sélecteurs CSS courants pour différents types de sites
 */
const SELECTEURS_ARTICLES = {
  // Structures génériques
  generiques: [
    'article a[href]',
    '.article a[href]',
    '.post a[href]',
    '.entry a[href]',
    '.news-item a[href]',
    '.card a[href]',
    '.item a[href]',
    '.story a[href]',
    '.teaser a[href]',
  ],
  // Titres de section
  titres: [
    'h1 a[href]',
    'h2 a[href]',
    'h3 a[href]',
    '.title a[href]',
    '.headline a[href]',
  ],
  // Listes d'actualités
  listes: [
    'ul.news li a[href]',
    'ul.articles li a[href]',
    'ul.posts li a[href]',
    '.list-item a[href]',
    '.news-list a[href]',
  ],
  // Grilles et layouts modernes
  grilles: [
    '.grid-item a[href]',
    '.masonry-item a[href]',
    '[class*="card"] a[href]',
    '[class*="article"] a[href]',
  ],
};

/**
 * Service de scraping des sources
 */
export class ServiceScraping {
  private readonly rssParser: Parser;
  private readonly options: Required<OptionsScraping>;

  constructor(options?: OptionsScraping) {
    this.options = { ...OPTIONS_DEFAUT, ...options };

    this.rssParser = new Parser({
      timeout: this.options.timeout,
      headers: {
        'User-Agent': this.options.userAgent,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
      customFields: {
        item: [
          ['media:content', 'mediaContent'],
          ['media:thumbnail', 'mediaThumbnail'],
          ['enclosure', 'enclosure'],
        ],
      },
    });
  }

  /**
   * Extrait les articles d'une URL
   */
  async extraireArticles(url: string, type?: TypeSource): Promise<ResultatExtraction> {
    // Validation SSRF - Bloquer les URLs internes
    const validationUrl = validerUrlScraping(url);
    if (!validationUrl.valide) {
      throw new Error(`URL invalide: ${validationUrl.erreur}`);
    }

    const urlSecurisee = validationUrl.urlNormalisee!;
    loggerScraping.info({ url: urlSecurisee, type }, 'Début extraction');

    try {
      // Essayer RSS/Atom d'abord
      if (!type || type === 'rss' || type === 'atom') {
        try {
          return await this.extraireRss(urlSecurisee);
        } catch (erreurRss) {
          loggerScraping.debug({ url: urlSecurisee, erreur: erreurRss }, 'RSS/Atom échoué, essai HTML');

          // Fallback vers HTML si RSS échoue
          if (type !== 'rss' && type !== 'atom') {
            return await this.extraireHtml(urlSecurisee);
          }
          throw erreurRss;
        }
      }

      // Extraction HTML directe
      return await this.extraireHtml(urlSecurisee);
    } catch (erreur) {
      loggerScraping.error({ url: urlSecurisee, erreur }, 'Échec extraction');
      throw erreur;
    }
  }

  /**
   * Extrait les articles depuis un flux RSS/Atom
   */
  async extraireRss(url: string): Promise<ResultatExtraction> {
    const feed = await this.rssParser.parseURL(url);

    const articles: ArticleBrut[] = (feed.items ?? [])
      .slice(0, this.options.maxArticles)
      .map(item => ({
        titre: item.title ?? 'Sans titre',
        lien: item.link ?? '',
        datePublication: item.pubDate ? new Date(item.pubDate) : new Date(),
        resume: this.nettoyerHtml(item.contentSnippet ?? item.content ?? null),
        urlImage: this.extraireImageRss(item),
        auteur: item.creator ?? item.author ?? null,
      }))
      .filter(article => article.lien);

    loggerScraping.info({ url, nombreArticles: articles.length }, 'Extraction RSS réussie');

    return {
      articles,
      titre: feed.title ?? null,
      favicon: feed.image?.url ?? null,
      type: this.detecterTypeFlux(feed),
    };
  }

  /**
   * Extrait les articles depuis une page HTML
   */
  async extraireHtml(url: string): Promise<ResultatExtraction> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.options.userAgent,
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(this.options.timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extraire les métadonnées
    const titre = $('title').text() || $('meta[property="og:title"]').attr('content') || null;
    const favicon = this.extraireFavicon($, url);

    // Chercher les liens vers des articles
    const articles: ArticleBrut[] = [];
    const baseUrl = new URL(url);

    // Utiliser les sélecteurs personnalisés + tous les sélecteurs par défaut
    const selecteurs = [
      ...this.options.selecteursPersonnalises,
      ...SELECTEURS_ARTICLES.generiques,
      ...SELECTEURS_ARTICLES.titres,
      ...SELECTEURS_ARTICLES.listes,
      ...SELECTEURS_ARTICLES.grilles,
    ];

    const liensVus = new Set<string>();

    for (const selecteur of selecteurs) {
      $(selecteur).each((_, el) => {
        const $el = $(el);
        let lien = $el.attr('href') ?? '';

        // Ignorer les liens non pertinents
        if (this.estLienIgnore(lien)) return;

        // Convertir en URL absolue
        if (lien && !lien.startsWith('http')) {
          try {
            lien = new URL(lien, baseUrl).toString();
          } catch {
            return;
          }
        }

        // Éviter les doublons et les liens vers la même page
        if (liensVus.has(lien)) return;
        if (lien === url || lien === url + '/') return;
        liensVus.add(lien);

        // Extraire les métadonnées de l'article
        const article = this.extraireArticleHtml($, $el, lien, baseUrl);
        if (article) {
          articles.push(article);
        }
      });

      if (articles.length >= this.options.maxArticles) break;
    }

    // Enrichir automatiquement si activé
    let articlesFinaux = articles.slice(0, this.options.maxArticles);
    if (this.options.enrichirAutomatiquement && articlesFinaux.length > 0) {
      articlesFinaux = await this.enrichirArticlesBatch(articlesFinaux);
    }

    loggerScraping.info({ url, nombreArticles: articlesFinaux.length }, 'Extraction HTML réussie');

    return {
      articles: articlesFinaux,
      titre,
      favicon,
      type: 'html',
    };
  }

  /**
   * Extrait le favicon d'une page
   */
  private extraireFavicon($: cheerio.CheerioAPI, url: string): string | null {
    const baseUrl = new URL(url);

    // Essayer différents sélecteurs
    const selecteurs = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]',
    ];

    for (const sel of selecteurs) {
      const href = $(sel).attr('href');
      if (href) {
        try {
          return new URL(href, baseUrl).toString();
        } catch {
          continue;
        }
      }
    }

    // Fallback vers /favicon.ico
    return `${baseUrl.origin}/favicon.ico`;
  }

  /**
   * Vérifie si un lien doit être ignoré
   */
  private estLienIgnore(lien: string): boolean {
    if (!lien) return true;

    const patternsIgnores = [
      /^#/,                        // Ancres
      /^javascript:/i,             // JavaScript
      /^mailto:/i,                 // Email
      /^tel:/i,                    // Téléphone
      /\.(pdf|zip|exe|dmg)$/i,     // Fichiers
      /\/(login|signup|register|auth)/i,  // Pages d'auth
      /\/(privacy|terms|about|contact)/i,  // Pages statiques
      /\/(category|tag|author)\//i, // Pages de navigation
      /page=\d+/i,                  // Pagination
    ];

    return patternsIgnores.some(pattern => pattern.test(lien));
  }

  /**
   * Extrait les métadonnées d'un article depuis un élément HTML
   */
  private extraireArticleHtml(
    _$: cheerio.CheerioAPI,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $el: cheerio.Cheerio<any>,
    lien: string,
    baseUrl: URL,
  ): ArticleBrut | null {
    // Remonter pour trouver le conteneur parent
    const $parent = $el.closest('article, .article, .post, .card, .item, .story, li');

    // Extraire le titre
    let titre = $el.attr('title');
    if (!titre) {
      titre = $el.find('h1, h2, h3, h4').first().text().trim();
    }
    if (!titre) {
      titre = $el.text().trim();
    }
    if (!titre || titre.length < 5 || titre.length > 512) return null;

    // Extraire la date si présente
    let datePublication = new Date();
    const $date = $parent.find('time, .date, .time, [datetime]').first();
    if ($date.length) {
      const dateStr = $date.attr('datetime') || $date.text();
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        datePublication = parsed;
      }
    }

    // Extraire le résumé
    let resume: string | null = null;
    const $resume = $parent.find('.excerpt, .summary, .description, p').first();
    if ($resume.length) {
      resume = $resume.text().trim().substring(0, 500) || null;
    }

    // Extraire l'image
    let urlImage: string | null = null;
    const $img = $parent.find('img').first();
    if ($img.length) {
      const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
      if (src) {
        try {
          urlImage = new URL(src, baseUrl).toString();
        } catch { /* ignore */ }
      }
    }

    // Extraire l'auteur
    let auteur: string | null = null;
    const $auteur = $parent.find('.author, .byline, [rel="author"]').first();
    if ($auteur.length) {
      auteur = $auteur.text().trim().substring(0, 100) || null;
    }

    return {
      titre: titre.substring(0, 512),
      lien,
      datePublication,
      resume,
      urlImage,
      auteur,
    };
  }

  /**
   * Enrichit un lot d'articles avec leurs métadonnées (en parallèle)
   */
  private async enrichirArticlesBatch(articles: ArticleBrut[]): Promise<ArticleBrut[]> {
    const BATCH_SIZE = 5; // Limiter les requêtes parallèles

    const enrichir = async (article: ArticleBrut): Promise<ArticleBrut> => {
      try {
        const meta = await this.enrichirArticle(article.lien);

        return {
          ...article,
          resume: article.resume || meta.openGraph.description || meta.twitter.description || null,
          urlImage: article.urlImage || meta.openGraph.image || meta.twitter.image || null,
        };
      } catch {
        return article;
      }
    };

    const resultats: ArticleBrut[] = [];

    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);
      const enrichis = await Promise.all(batch.map(enrichir));
      resultats.push(...enrichis);
    }

    return resultats;
  }

  /**
   * Enrichit un article avec les métadonnées Open Graph et Twitter
   */
  async enrichirArticle(url: string): Promise<{
    openGraph: MetaOpenGraph;
    twitter: MetaTwitter;
  }> {
    // Validation SSRF
    const validationUrl = validerUrlScraping(url);
    if (!validationUrl.valide) {
      loggerScraping.warn({ url, erreur: validationUrl.erreur }, 'URL enrichissement bloquée');
      return { openGraph: {}, twitter: {} };
    }

    const urlSecurisee = validationUrl.urlNormalisee!;

    try {
      const response = await fetch(urlSecurisee, {
        headers: {
          'User-Agent': this.options.userAgent,
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(this.options.timeout),
      });

      if (!response.ok) {
        return { openGraph: {}, twitter: {} };
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const openGraph: MetaOpenGraph = {
        titre: $('meta[property="og:title"]').attr('content'),
        description: $('meta[property="og:description"]').attr('content'),
        image: $('meta[property="og:image"]').attr('content'),
        type: $('meta[property="og:type"]').attr('content'),
        url: $('meta[property="og:url"]').attr('content'),
        siteName: $('meta[property="og:site_name"]').attr('content'),
      };

      const twitter: MetaTwitter = {
        titre: $('meta[name="twitter:title"]').attr('content'),
        description: $('meta[name="twitter:description"]').attr('content'),
        image: $('meta[name="twitter:image"]').attr('content'),
        card: $('meta[name="twitter:card"]').attr('content'),
        site: $('meta[name="twitter:site"]').attr('content'),
      };

      return { openGraph, twitter };
    } catch (erreur) {
      loggerScraping.warn({ url, erreur }, 'Échec enrichissement métadonnées');
      return { openGraph: {}, twitter: {} };
    }
  }

  /**
   * Détecte si une URL est un flux RSS/Atom ou une page HTML
   */
  async detecterType(url: string): Promise<TypeSource> {
    // Validation SSRF
    const validationUrl = validerUrlScraping(url);
    if (!validationUrl.valide) {
      throw new Error(`URL invalide: ${validationUrl.erreur}`);
    }

    const urlSecurisee = validationUrl.urlNormalisee!;

    try {
      const response = await fetch(urlSecurisee, {
        method: 'HEAD',
        headers: { 'User-Agent': this.options.userAgent },
        signal: AbortSignal.timeout(5000),
      });

      const contentType = response.headers.get('content-type') ?? '';

      if (
        contentType.includes('rss') ||
        contentType.includes('atom') ||
        contentType.includes('xml')
      ) {
        // Vérifier si c'est vraiment un flux valide
        try {
          await this.rssParser.parseURL(urlSecurisee);
          return 'rss';
        } catch {
          return 'html';
        }
      }

      return 'html';
    } catch {
      // En cas d'erreur, essayer de parser comme RSS
      try {
        await this.rssParser.parseURL(urlSecurisee);
        return 'rss';
      } catch {
        return 'html';
      }
    }
  }

  /**
   * Extrait l'image d'un item RSS
   */
  private extraireImageRss(item: Parser.Item & {
    mediaContent?: { $?: { url?: string } };
    mediaThumbnail?: { $?: { url?: string } };
    enclosure?: { url?: string };
  }): string | null {
    // media:content
    if (item.mediaContent?.$?.url) {
      return item.mediaContent.$.url;
    }

    // media:thumbnail
    if (item.mediaThumbnail?.$?.url) {
      return item.mediaThumbnail.$.url;
    }

    // enclosure (souvent utilisé pour les podcasts)
    if (item.enclosure?.url) {
      const url = item.enclosure.url;
      if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        return url;
      }
    }

    // Chercher dans le contenu HTML
    if (item.content) {
      const $ = cheerio.load(item.content);
      const img = $('img').first().attr('src');
      if (img) return img;
    }

    return null;
  }

  /**
   * Nettoie le HTML d'un texte
   */
  private nettoyerHtml(html: string | null): string | null {
    if (!html) return null;

    const $ = cheerio.load(html);
    const texte = $.text().trim();

    // Limiter à 500 caractères
    if (texte.length > 500) {
      return texte.substring(0, 497) + '...';
    }

    return texte || null;
  }

  /**
   * Détecte si le flux est RSS ou Atom
   */
  private detecterTypeFlux(feed: Parser.Output<Parser.Item>): TypeSource {
    // Parser normalise en "items", mais on peut regarder la structure originale
    if (feed.feedUrl?.includes('atom')) {
      return 'atom';
    }
    return 'rss';
  }
}

/**
 * Instance singleton du service
 */
let instanceScraping: ServiceScraping | null = null;

export function obtenirServiceScraping(): ServiceScraping {
  if (!instanceScraping) {
    instanceScraping = new ServiceScraping();
  }
  return instanceScraping;
}
