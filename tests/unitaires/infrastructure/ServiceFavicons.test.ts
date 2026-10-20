/**
 * Veilleur - Cache local des favicons des sources
 * Le navigateur ne doit jamais appeler un site tiers : le serveur télécharge le favicon
 * une fois, le garde sur disque et le sert depuis sa propre origine.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readdir, readFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('@/infrastructure/scraping/validationUrl', () => ({
  validerUrlScraping: vi.fn((url: string) =>
    url.includes('interdit') ? { valide: false, erreur: 'URL interdite' } : { valide: true, urlNormalisee: url }),
  validerRedirection: vi.fn((_origine: string, url: string) =>
    url.includes('interdit') ? { valide: false, erreur: 'Redirection interdite' } : { valide: true, urlNormalisee: url }),
}));
vi.mock('@/infrastructure/logging/logger', () => ({
  loggerScraping: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ServiceFavicons } from '@/infrastructure/favicons/ServiceFavicons';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

type Reponse = { statut?: number; type?: string; corps?: Uint8Array; location?: string };

/** Simule le réseau : une réponse par URL, et compte les appels */
function simulerReseau(reponses: Record<string, Reponse>) {
  const appels: string[] = [];
  const fetchImpl = vi.fn(async (url: string) => {
    appels.push(url);
    const r = reponses[url];
    if (!r) throw new Error('réseau');
    const headers = new Headers();
    if (r.type) headers.set('content-type', r.type);
    if (r.location) headers.set('location', r.location);
    return new Response(r.corps ?? null, { status: r.statut ?? 200, headers });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, appels };
}

describe('ServiceFavicons', () => {
  let dossier: string;

  beforeEach(async () => {
    dossier = await mkdtemp(join(tmpdir(), 'veilleur-favicons-'));
  });
  afterEach(async () => {
    await rm(dossier, { recursive: true, force: true });
  });

  it('télécharge le favicon, le stocke sur disque et renvoie son chemin et son type', async () => {
    const { fetchImpl, appels } = simulerReseau({ 'https://journal.fr/favicon.png': { type: 'image/png', corps: PNG } });
    const service = new ServiceFavicons({ dossier, fetchImpl });

    const favicon = await service.obtenir('src1', 'https://journal.fr/favicon.png');

    expect(favicon).toEqual({ chemin: join(dossier, 'src1.png'), typeMime: 'image/png' });
    expect(await readFile(join(dossier, 'src1.png'))).toEqual(Buffer.from(PNG));
    expect(appels).toEqual(['https://journal.fr/favicon.png']);
  });

  it('réutilise le fichier frais sans retélécharger', async () => {
    const { fetchImpl, appels } = simulerReseau({ 'https://journal.fr/favicon.png': { type: 'image/png', corps: PNG } });
    const service = new ServiceFavicons({ dossier, fetchImpl });

    await service.obtenir('src1', 'https://journal.fr/favicon.png');
    const second = await service.obtenir('src1', 'https://journal.fr/favicon.png');

    expect(second?.typeMime).toBe('image/png');
    expect(appels).toHaveLength(1);
  });

  it('retrouve un fichier déjà sur disque après redémarrage (sans index en mémoire)', async () => {
    const { fetchImpl, appels } = simulerReseau({ 'https://journal.fr/favicon.png': { type: 'image/png', corps: PNG } });
    await new ServiceFavicons({ dossier, fetchImpl }).obtenir('src1', 'https://journal.fr/favicon.png');

    const favicon = await new ServiceFavicons({ dossier, fetchImpl }).obtenir('src1', 'https://journal.fr/favicon.png');

    expect(favicon?.chemin).toBe(join(dossier, 'src1.png'));
    expect(appels).toHaveLength(1);
  });

  it('retélécharge un fichier périmé et sert l\'ancien si le réseau échoue', async () => {
    const { fetchImpl, appels } = simulerReseau({ 'https://journal.fr/favicon.png': { type: 'image/png', corps: PNG } });
    const service = new ServiceFavicons({ dossier, fetchImpl, dureeValiditeMs: 1000 });
    await service.obtenir('src1', 'https://journal.fr/favicon.png');
    const vieux = new Date(Date.now() - 10_000);
    await utimes(join(dossier, 'src1.png'), vieux, vieux);
    (fetchImpl as unknown as { mockImplementation: (f: () => Promise<never>) => void }).mockImplementation(async () => { throw new Error('réseau'); });

    const favicon = await service.obtenir('src1', 'https://journal.fr/favicon.png');

    expect(favicon?.chemin).toBe(join(dossier, 'src1.png'));
    expect(appels).toHaveLength(1);
  });

  it('renvoie null sans toucher au réseau quand la source n\'a pas de favicon', async () => {
    const { fetchImpl, appels } = simulerReseau({});
    const service = new ServiceFavicons({ dossier, fetchImpl });

    expect(await service.obtenir('src1', null)).toBeNull();
    expect(appels).toEqual([]);
  });

  it('refuse une URL que la validation anti-SSRF rejette', async () => {
    const { fetchImpl, appels } = simulerReseau({});
    const service = new ServiceFavicons({ dossier, fetchImpl });

    expect(await service.obtenir('src1', 'https://interdit.local/favicon.ico')).toBeNull();
    expect(appels).toEqual([]);
  });

  it('refuse un contenu qui n\'est pas une image', async () => {
    const { fetchImpl } = simulerReseau({ 'https://journal.fr/favicon.ico': { type: 'text/html', corps: new TextEncoder().encode('<html>') } });
    const service = new ServiceFavicons({ dossier, fetchImpl });

    expect(await service.obtenir('src1', 'https://journal.fr/favicon.ico')).toBeNull();
    expect(await readdir(dossier)).toEqual([]);
  });

  it('refuse un fichier plus gros que la limite', async () => {
    const gros = new Uint8Array(2048);
    const { fetchImpl } = simulerReseau({ 'https://journal.fr/favicon.png': { type: 'image/png', corps: gros } });
    const service = new ServiceFavicons({ dossier, fetchImpl, tailleMaxOctets: 1024 });

    expect(await service.obtenir('src1', 'https://journal.fr/favicon.png')).toBeNull();
  });

  it('mémorise un échec pour ne pas réessayer à chaque requête', async () => {
    const { fetchImpl, appels } = simulerReseau({});
    const service = new ServiceFavicons({ dossier, fetchImpl });

    await service.obtenir('src1', 'https://journal.fr/favicon.png');
    await service.obtenir('src1', 'https://journal.fr/favicon.png');

    expect(appels).toHaveLength(1);
  });

  it('suit une redirection sûre et déduit le type ICO', async () => {
    const { fetchImpl, appels } = simulerReseau({
      'https://journal.fr/favicon.ico': { statut: 301, location: 'https://cdn.journal.fr/fav.ico' },
      'https://cdn.journal.fr/fav.ico': { type: 'image/x-icon', corps: PNG },
    });
    const service = new ServiceFavicons({ dossier, fetchImpl });

    const favicon = await service.obtenir('src1', 'https://journal.fr/favicon.ico');

    expect(favicon).toEqual({ chemin: join(dossier, 'src1.ico'), typeMime: 'image/x-icon' });
    expect(appels).toEqual(['https://journal.fr/favicon.ico', 'https://cdn.journal.fr/fav.ico']);
  });

  it('refuse une redirection vers une URL interdite', async () => {
    const { fetchImpl, appels } = simulerReseau({
      'https://journal.fr/favicon.ico': { statut: 302, location: 'https://interdit.local/x.ico' },
    });
    const service = new ServiceFavicons({ dossier, fetchImpl });

    expect(await service.obtenir('src1', 'https://journal.fr/favicon.ico')).toBeNull();
    expect(appels).toEqual(['https://journal.fr/favicon.ico']);
  });

  it('déduit le type depuis l\'extension quand le serveur répond en octet-stream', async () => {
    const { fetchImpl } = simulerReseau({ 'https://journal.fr/icone.svg': { type: 'application/octet-stream', corps: new TextEncoder().encode('<svg/>') } });
    const service = new ServiceFavicons({ dossier, fetchImpl });

    const favicon = await service.obtenir('src1', 'https://journal.fr/icone.svg');

    expect(favicon?.typeMime).toBe('image/svg+xml');
  });
});
