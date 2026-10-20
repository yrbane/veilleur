/**
 * Veilleur - Récupération HTTP avec redirections suivies à la main
 * Chaque saut est validé (anti-SSRF) : un site public ne peut pas nous rediriger vers le réseau interne.
 */

import { validerRedirection, validerUrlScraping } from './validationUrl';

export interface OptionsRecuperation {
  fetchImpl: typeof fetch;
  timeoutMs: number;
  userAgent: string;
  accept: string;
  redirectionsMax?: number;
}

const REDIRECTIONS_MAX_DEFAUT = 3;

/**
 * Retourne la réponse finale (2xx) ou null : URL refusée, injoignable, trop de sauts, erreur HTTP
 */
export async function recupererAvecRedirections(
  urlInitiale: string,
  options: OptionsRecuperation,
): Promise<{ reponse: Response; url: string } | null> {
  const validation = validerUrlScraping(urlInitiale);
  if (!validation.valide || !validation.urlNormalisee) return null;
  const redirectionsMax = options.redirectionsMax ?? REDIRECTIONS_MAX_DEFAUT;
  let url = validation.urlNormalisee;
  for (let saut = 0; saut <= redirectionsMax; saut++) {
    let reponse: Response;
    try {
      reponse = await options.fetchImpl(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(options.timeoutMs),
        headers: { 'user-agent': options.userAgent, accept: options.accept },
      });
    } catch {
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
    return reponse.ok ? { reponse, url } : null;
  }
  return null;
}
