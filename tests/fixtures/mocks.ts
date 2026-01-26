/**
 * Fixtures de test - Mocks des dépôts et services
 */

import { vi } from 'vitest';
import type { DepotSources } from '../../src/domaine/ports/DepotSources';
import type { DepotArticles } from '../../src/domaine/ports/DepotArticles';
import type { DepotUtilisateurs, DepotRefreshTokens } from '../../src/domaine/ports/DepotUtilisateurs';
import type { ServiceCache, OptionsCache } from '../../src/domaine/ports/ServiceCache';

/**
 * Mock du dépôt Sources
 */
export function creerMockDepotSources(): DepotSources {
  return {
    trouverParId: vi.fn(),
    trouverParHashUrl: vi.fn(),
    creer: vi.fn(),
    mettreAJour: vi.fn(),
    supprimer: vi.fn(),
    listerPourUtilisateur: vi.fn(),
    ajouterPourUtilisateur: vi.fn(),
    retirerPourUtilisateur: vi.fn(),
    utilisateurSuitSource: vi.fn(),
    noterSource: vi.fn(),
    basculerPause: vi.fn(),
    incrementerEchecs: vi.fn(),
    reinitialiserEchecs: vi.fn(),
    listerSourcesARafraichir: vi.fn(),
    compterSourcesUtilisateur: vi.fn(),
  };
}

/**
 * Mock du dépôt Articles
 */
export function creerMockDepotArticles(): DepotArticles {
  return {
    trouverParId: vi.fn(),
    trouverParHashContenu: vi.fn(),
    creer: vi.fn(),
    creerPlusieurs: vi.fn(),
    mettreAJour: vi.fn(),
    supprimerParSource: vi.fn(),
    supprimerAnciens: vi.fn(),
    listerFilUtilisateur: vi.fn(),
    listerParSource: vi.fn(),
    compterParSource: vi.fn(),
    articleExiste: vi.fn(),
    trouverDoublonsPotentiels: vi.fn(),
  };
}

/**
 * Mock du dépôt Utilisateurs
 */
export function creerMockDepotUtilisateurs(): DepotUtilisateurs {
  return {
    trouverParId: vi.fn(),
    trouverParEmail: vi.fn(),
    creer: vi.fn(),
    mettreAJour: vi.fn(),
    emailExiste: vi.fn(),
    mettreAJourDerniereConnexion: vi.fn(),
    desactiver: vi.fn(),
  };
}

/**
 * Mock du dépôt Refresh Tokens
 */
export function creerMockDepotRefreshTokens(): DepotRefreshTokens {
  return {
    creer: vi.fn(),
    trouverTokenValide: vi.fn(),
    revoquer: vi.fn(),
    revoquerTousTokensUtilisateur: vi.fn(),
    nettoyerTokensExpires: vi.fn(),
  };
}

/**
 * Mock du service de cache (en mémoire)
 */
export function creerMockServiceCache(): ServiceCache {
  const cache = new Map<string, { value: unknown; expireAt: number }>();

  const mock: ServiceCache = {
    obtenir: vi.fn(async <T>(cle: string): Promise<T | null> => {
      const item = cache.get(cle);
      if (!item) return null;
      if (Date.now() > item.expireAt) {
        cache.delete(cle);
        return null;
      }
      return item.value as T;
    }),
    stocker: vi.fn(async <T>(cle: string, valeur: T, options?: OptionsCache): Promise<void> => {
      const ttl = options?.ttl ?? 3600;
      const expireAt = Date.now() + ttl * 1000;
      cache.set(cle, { value: valeur, expireAt });
    }),
    supprimer: vi.fn(async (cle: string): Promise<boolean> => {
      return cache.delete(cle);
    }),
    supprimerPattern: vi.fn(async (pattern: string): Promise<number> => {
      let count = 0;
      const regex = new RegExp(pattern.replace('*', '.*'));
      for (const key of cache.keys()) {
        if (regex.test(key)) {
          cache.delete(key);
          count++;
        }
      }
      return count;
    }),
    existe: vi.fn(async (cle: string): Promise<boolean> => {
      const item = cache.get(cle);
      if (!item) return false;
      if (Date.now() > item.expireAt) {
        cache.delete(cle);
        return false;
      }
      return true;
    }),
    ttl: vi.fn(async (cle: string): Promise<number> => {
      const item = cache.get(cle);
      if (!item) return -2;
      const remaining = Math.floor((item.expireAt - Date.now()) / 1000);
      return remaining > 0 ? remaining : -1;
    }),
    incrementer: vi.fn(async (cle: string, valeur = 1): Promise<number> => {
      const item = cache.get(cle);
      const current = item ? Number(item.value) : 0;
      const newVal = current + valeur;
      cache.set(cle, { value: newVal, expireAt: item?.expireAt ?? Date.now() + 3600000 });
      return newVal;
    }),
    decrementer: vi.fn(async (cle: string, valeur = 1): Promise<number> => {
      const item = cache.get(cle);
      const current = item ? Number(item.value) : 0;
      const newVal = current - valeur;
      cache.set(cle, { value: newVal, expireAt: item?.expireAt ?? Date.now() + 3600000 });
      return newVal;
    }),
    obtenirOuStocker: vi.fn(async <T>(
      cle: string,
      fabrique: () => Promise<T>,
      options?: OptionsCache,
    ): Promise<T> => {
      const existing = await mock.obtenir<T>(cle);
      if (existing !== null) return existing;
      const value = await fabrique();
      await mock.stocker(cle, value, options);
      return value;
    }),
    ping: vi.fn(async (): Promise<boolean> => true),
    fermer: vi.fn(async (): Promise<void> => {
      cache.clear();
    }),
  };

  return mock;
}

/**
 * Mock de fetch pour les tests HTTP
 */
export function creerMockFetch(responses: Map<string, Response>) {
  return vi.fn(async (url: string | URL | Request) => {
    const urlString = url.toString();
    const response = responses.get(urlString);
    if (response) {
      return response;
    }
    return new Response('Not Found', { status: 404 });
  });
}

/**
 * Crée une réponse mock pour fetch
 */
export function creerReponse(
  body: string | object,
  options: ResponseInit = {},
): Response {
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(bodyString, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
}

/**
 * Helper pour réinitialiser tous les mocks
 */
export function resetAllMocks(...mocks: object[]) {
  for (const mock of mocks) {
    for (const key of Object.keys(mock)) {
      const fn = (mock as Record<string, unknown>)[key];
      if (typeof fn === 'function' && 'mockReset' in fn) {
        (fn as ReturnType<typeof vi.fn>).mockReset();
      }
    }
  }
}
