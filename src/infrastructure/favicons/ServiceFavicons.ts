/**
 * Veilleur - Cache local des favicons des sources
 * Le navigateur n'appelle jamais un site tiers : le serveur télécharge le favicon une
 * fois (URL stockée en base, validée contre le SSRF), le garde sur disque et le sert
 * depuis sa propre origine. Un échec est mémorisé pour ne pas marteler le site.
 */

import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validerRedirection, validerUrlScraping } from '../scraping/validationUrl';
import { loggerScraping } from '../logging/logger';

export interface FaviconServi {
  chemin: string;
  typeMime: string;
}

export interface OptionsServiceFavicons {
  /** Répertoire de stockage, créé au besoin */
  dossier: string;
  fetchImpl?: typeof fetch;
  tailleMaxOctets?: number;
  timeoutMs?: number;
  /** Au-delà, le fichier est retéléchargé (l'ancien est servi si le réseau échoue) */
  dureeValiditeMs?: number;
  /** Fenêtre pendant laquelle un échec n'est pas réessayé */
  dureeEchecMs?: number;
  userAgent?: string;
}

const EXTENSION_PAR_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/svg+xml': 'svg',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const TYPE_PAR_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSION_PAR_TYPE).map(([type, ext]) => [ext, type]),
);
// Les deux types ICO partagent l'extension : on sert le plus répandu
TYPE_PAR_EXTENSION.ico = 'image/x-icon';

const EXTENSIONS = Object.keys(TYPE_PAR_EXTENSION);

function typePourExtension(extension: string): string {
  return TYPE_PAR_EXTENSION[extension] ?? 'application/octet-stream';
}
const REDIRECTIONS_MAX = 3;

export class ServiceFavicons {
  private readonly dossier: string;
  private readonly fetchImpl: typeof fetch;
  private readonly tailleMaxOctets: number;
  private readonly timeoutMs: number;
  private readonly dureeValiditeMs: number;
  private readonly dureeEchecMs: number;
  private readonly userAgent: string;
  private readonly echecs = new Map<string, number>();
  private dossierPret: Promise<void> | null = null;

  constructor(options: OptionsServiceFavicons) {
    this.dossier = options.dossier;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.tailleMaxOctets = options.tailleMaxOctets ?? 256 * 1024;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.dureeValiditeMs = options.dureeValiditeMs ?? 7 * 24 * 3600 * 1000;
    this.dureeEchecMs = options.dureeEchecMs ?? 3600 * 1000;
    this.userAgent = options.userAgent ?? 'Veilleur/1.0 (+https://github.com/yrbane/veilleur)';
  }

  /**
   * Renvoie le favicon local d'une source, en le téléchargeant si nécessaire
   */
  async obtenir(sourceId: string, urlFavicon: string | null): Promise<FaviconServi | null> {
    if (!urlFavicon) return null;

    const existant = await this.trouverSurDisque(sourceId);
    if (existant && existant.age < this.dureeValiditeMs) return existant.favicon;

    const dernierEchec = this.echecs.get(sourceId);
    if (dernierEchec !== undefined && Date.now() - dernierEchec < this.dureeEchecMs) {
      return existant?.favicon ?? null;
    }

    const telecharge = await this.telecharger(sourceId, urlFavicon);
    if (telecharge) {
      this.echecs.delete(sourceId);
      return telecharge;
    }
    this.echecs.set(sourceId, Date.now());
    return existant?.favicon ?? null;
  }

  private async trouverSurDisque(sourceId: string): Promise<{ favicon: FaviconServi; age: number } | null> {
    for (const extension of EXTENSIONS) {
      const chemin = join(this.dossier, `${sourceId}.${extension}`);
      try {
        const infos = await stat(chemin);
        return { favicon: { chemin, typeMime: typePourExtension(extension) }, age: Date.now() - infos.mtimeMs };
      } catch {
        // pas ce format-là
      }
    }
    return null;
  }

  private async telecharger(sourceId: string, urlFavicon: string): Promise<FaviconServi | null> {
    const reponse = await this.recupererAvecRedirections(urlFavicon);
    if (!reponse) return null;

    const typeMime = this.deduireType(reponse, urlFavicon);
    if (!typeMime) {
      loggerScraping.debug({ sourceId, urlFavicon }, 'Favicon ignoré : type non image');
      return null;
    }

    const longueurAnnoncee = Number(reponse.headers.get('content-length') ?? 0);
    if (longueurAnnoncee > this.tailleMaxOctets) return null;
    let corps: Buffer;
    try {
      corps = Buffer.from(await reponse.arrayBuffer());
    } catch {
      return null;
    }
    if (corps.length === 0 || corps.length > this.tailleMaxOctets) return null;

    const extension = EXTENSION_PAR_TYPE[typeMime] ?? 'bin';
    const chemin = join(this.dossier, `${sourceId}.${extension}`);
    try {
      await this.preparerDossier();
      const temporaire = `${chemin}.${process.pid}.tmp`;
      await writeFile(temporaire, corps);
      await rename(temporaire, chemin);
      await this.supprimerAutresFormats(sourceId, extension);
    } catch (erreur) {
      loggerScraping.warn({ sourceId, erreur }, 'Impossible d\'écrire le favicon en cache');
      return null;
    }
    return { chemin, typeMime: typePourExtension(extension) };
  }

  /**
   * Suit les redirections à la main pour valider chaque saut (anti-SSRF)
   */
  private async recupererAvecRedirections(urlInitiale: string): Promise<Response | null> {
    const validation = validerUrlScraping(urlInitiale);
    if (!validation.valide || !validation.urlNormalisee) return null;

    let url = validation.urlNormalisee;
    for (let saut = 0; saut <= REDIRECTIONS_MAX; saut++) {
      let reponse: Response;
      try {
        reponse = await this.fetchImpl(url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: { 'user-agent': this.userAgent, accept: 'image/*' },
        });
      } catch (erreur) {
        loggerScraping.debug({ url, erreur }, 'Favicon injoignable');
        return null;
      }

      if (reponse.status >= 300 && reponse.status < 400) {
        const destination = reponse.headers.get('location');
        if (!destination) return null;
        const suivante = validerRedirection(url, new URL(destination, url).toString());
        if (!suivante.valide || !suivante.urlNormalisee) return null;
        url = suivante.urlNormalisee;
        continue;
      }
      return reponse.ok ? reponse : null;
    }
    return null;
  }

  private deduireType(reponse: Response, url: string): string | null {
    const annonce = (reponse.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    if (EXTENSION_PAR_TYPE[annonce]) return annonce;
    // Seul un type générique autorise à se fier à l'extension de l'URL
    if (annonce !== '' && annonce !== 'application/octet-stream' && annonce !== 'binary/octet-stream') return null;
    const extension = new URL(url).pathname.split('.').pop()?.toLowerCase() ?? '';
    return TYPE_PAR_EXTENSION[extension] ?? null;
  }

  private preparerDossier(): Promise<void> {
    if (!this.dossierPret) {
      this.dossierPret = mkdir(this.dossier, { recursive: true }).then(() => undefined);
    }
    return this.dossierPret;
  }

  private async supprimerAutresFormats(sourceId: string, extensionGardee: string): Promise<void> {
    await Promise.all(
      EXTENSIONS.filter(ext => ext !== extensionGardee).map(ext =>
        unlink(join(this.dossier, `${sourceId}.${ext}`)).catch(() => undefined),
      ),
    );
  }
}
