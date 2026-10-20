/**
 * Veilleur - Lecture en place
 * Télécharge la page d'un article, en isole le contenu principal (Readability)
 * et le nettoie (sanitize-html) avant de le servir au client.
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';
import sanitizeHtml from 'sanitize-html';
import type { ServiceCache } from '@/domaine/ports/ServiceCache';
import { PREFIXES_CACHE } from '@/domaine/ports/ServiceCache';
import { recupererAvecRedirections } from '../scraping/recupererAvecRedirections';
import { loggerScraping } from '../logging/logger';

export interface ContenuLecture {
  titre: string;
  contenuHtml: string;
  extrait: string | null;
  auteur: string | null;
  nombreMots: number;
  dureeLectureMin: number;
}

export interface OptionsServiceLecture {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  tailleMaxOctets?: number;
  userAgent?: string;
  /** Nombre minimal de caractères pour que Readability considère la page comme un article */
  seuilCaracteres?: number;
  serviceCache?: Pick<ServiceCache, 'obtenir' | 'stocker'>;
  dureeCacheS?: number;
  /**
   * Remplace l'adresse de chaque image par une adresse servie par Veilleur (cache local) ;
   * null retire l'image. Sans résolveur, les images restent pointées vers le site d'origine.
   */
  resoudreImage?: (url: string) => Promise<string | null>;
}

const MOTS_PAR_MINUTE = 200;
const SEUIL_CARACTERES_DEFAUT = 500;
const TITRE_MAX = 200;
const TAILLE_MAX_DEFAUT = 2 * 1024 * 1024;
const CACHE_DEFAUT_S = 24 * 3600;

/**
 * Règles de nettoyage : balises de mise en forme uniquement, pas de style ni de script,
 * images en https (seul schéma autorisé par la CSP), liens absolus ouverts dans un nouvel onglet.
 */
const REGLES_NETTOYAGE: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'figure', 'figcaption', 'strong', 'em', 'b', 'i', 'u', 's', 'br', 'hr', 'table', 'thead', 'tbody',
    'tr', 'th', 'td', 'sup', 'sub', 'span', 'div', 'section', 'cite', 'time', 'small', 'mark', 'dl', 'dt', 'dd',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    time: ['datetime'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['https'] },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
  },
  // Une image dont la source a été retirée (http) ou un paragraphe vide n'apportent rien
  exclusiveFilter: frame => (frame.tag === 'img' && !frame.attribs.src) || (frame.tag === 'p' && frame.text.trim() === ''),
};

export class ServiceLecture {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly tailleMaxOctets: number;
  private readonly userAgent: string;
  private readonly seuilCaracteres: number | undefined;
  private readonly serviceCache: Pick<ServiceCache, 'obtenir' | 'stocker'> | undefined;
  private readonly dureeCacheS: number;
  private readonly resoudreImage: ((url: string) => Promise<string | null>) | undefined;

  constructor(options: OptionsServiceLecture = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.tailleMaxOctets = options.tailleMaxOctets ?? TAILLE_MAX_DEFAUT;
    this.userAgent = options.userAgent ?? 'Veilleur/1.0';
    this.seuilCaracteres = options.seuilCaracteres;
    this.serviceCache = options.serviceCache;
    this.dureeCacheS = options.dureeCacheS ?? CACHE_DEFAUT_S;
    this.resoudreImage = options.resoudreImage;
  }

  /**
   * Contenu lisible de l'article, ou null si la page est inaccessible, trop lourde ou sans article
   */
  async extraire(articleId: string, url: string): Promise<ContenuLecture | null> {
    const cle = `${PREFIXES_CACHE.ARTICLES}lecture:${articleId}`;
    const enCache = await this.serviceCache?.obtenir<ContenuLecture>(cle);
    if (enCache) return enCache;

    const html = await this.telecharger(url);
    if (html === null) return null;
    const contenu = this.extraireDepuisHtml(html, url);
    if (contenu && this.resoudreImage) {
      contenu.contenuHtml = await this.reecrireImages(contenu.contenuHtml, this.resoudreImage);
    }
    if (contenu && this.serviceCache) {
      await this.serviceCache.stocker(cle, contenu, { ttl: this.dureeCacheS });
    }
    return contenu;
  }

  /**
   * Fait passer chaque image par le résolveur (HTML déjà nettoyé : balises simples, sans script)
   */
  private async reecrireImages(contenuHtml: string, resoudre: (url: string) => Promise<string | null>): Promise<string> {
    const dom = new JSDOM('', { virtualConsole: new VirtualConsole() });
    try {
      const conteneur = dom.window.document.createElement('div');
      conteneur.innerHTML = contenuHtml;
      for (const image of Array.from(conteneur.querySelectorAll('img'))) {
        const source = image.getAttribute('src') ?? '';
        let locale: string | null = null;
        try {
          locale = await resoudre(source);
        } catch (erreur) {
          loggerScraping.debug({ source, erreur }, 'Lecture : image non résolue');
        }
        if (!locale) {
          image.remove();
          continue;
        }
        image.setAttribute('src', locale);
        image.setAttribute('loading', 'lazy');
      }
      return conteneur.innerHTML;
    } finally {
      dom.window.close();
    }
  }

  private async telecharger(url: string): Promise<string | null> {
    const resultat = await recupererAvecRedirections(url, {
      fetchImpl: this.fetchImpl,
      timeoutMs: this.timeoutMs,
      userAgent: this.userAgent,
      accept: 'text/html,application/xhtml+xml',
    });
    if (!resultat) return null;
    const { reponse } = resultat;
    const type = (reponse.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase();
    if (type !== 'text/html' && type !== 'application/xhtml+xml') return null;
    if (Number(reponse.headers.get('content-length') ?? 0) > this.tailleMaxOctets) return null;
    try {
      const corps = Buffer.from(await reponse.arrayBuffer());
      if (corps.length > this.tailleMaxOctets) return null;
      return corps.toString('utf8');
    } catch (erreur) {
      loggerScraping.debug({ url, erreur }, 'Lecture : corps de page illisible');
      return null;
    }
  }

  private extraireDepuisHtml(html: string, url: string): ContenuLecture | null {
    // Console virtuelle muette : jsdom se plaint des feuilles de style des sites, sans intérêt ici
    const dom = new JSDOM(html, { url, virtualConsole: new VirtualConsole() });
    try {
      const document = dom.window.document;
      // Le <h1> de la page est le titre le plus fiable ; Readability garde souvent « Titre | Site »
      const titreH1 = Array.from(document.querySelectorAll('h1'))
        .map(h => h.textContent?.trim() ?? '')
        .find(t => t.length > 0 && t.length <= TITRE_MAX);
      const seuil = this.seuilCaracteres ?? SEUIL_CARACTERES_DEFAUT;
      const article = new Readability(document, { charThreshold: seuil }).parse();
      const texte = article?.textContent?.trim() ?? '';
      // Readability renvoie toujours quelque chose : on exige un vrai corps d'article
      if (!article?.content || texte.length < seuil) return null;
      const contenuHtml = sanitizeHtml(article.content, REGLES_NETTOYAGE).trim();
      if (!contenuHtml) return null;
      const nombreMots = texte.split(/\s+/).length;
      return {
        titre: titreH1 || article.title?.trim() || document.title,
        contenuHtml,
        extrait: article.excerpt?.trim() || null,
        auteur: article.byline?.trim() || null,
        nombreMots,
        dureeLectureMin: Math.max(1, Math.round(nombreMots / MOTS_PAR_MINUTE)),
      };
    } catch (erreur) {
      loggerScraping.warn({ url, erreur }, 'Lecture : extraction impossible');
      return null;
    } finally {
      dom.window.close();
    }
  }
}
