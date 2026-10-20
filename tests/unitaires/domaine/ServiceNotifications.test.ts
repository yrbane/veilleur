/**
 * Veilleur - Notifications push et résumés courriel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceNotifications, composerPushNouveauxArticles } from '@/domaine/services/ServiceNotifications';
import { composerResume, grouperParSource, echapperHtml } from '@/domaine/services/ResumeCourriel';
import type { ArticleAvecSource } from '@/domaine/entites/Article';

const abonnement = (endpoint: string) => ({ endpoint, clePublique: 'p', secretAuth: 'a' });

function article(partiel: Partial<ArticleAvecSource> & { titre: string; nomSource: string }): ArticleAvecSource {
  const { nomSource, ...reste } = partiel;
  return {
    id: 'a', sourceId: 's', lien: 'https://j.fr/a', datePublication: new Date('2026-10-21T08:00:00Z'), resume: null,
    source: { nom: nomSource, urlFavicon: null },
    ...reste,
  } as ArticleAvecSource;
}

describe('composerPushNouveauxArticles', () => {
  it('résume le nombre et les sources, en abrégeant au-delà de trois', () => {
    expect(composerPushNouveauxArticles(1, ['Le Monde'])).toMatchObject({ titre: '1 nouvel article', corps: 'Le Monde', url: '/?nonLus=1' });
    expect(composerPushNouveauxArticles(12, ['A', 'B', 'A', 'C'])).toMatchObject({ titre: '12 nouveaux articles' , corps: 'A, B, C' });
    expect(composerPushNouveauxArticles(7, ['A', 'B', 'C', 'D', 'E']).corps).toBe('A, B et 3 autres sources');
  });
});

describe('ServiceNotifications.notifierNouveauxArticles', () => {
  let depot: Record<string, ReturnType<typeof vi.fn>>;
  let push: { estConfigure: ReturnType<typeof vi.fn>; envoyer: ReturnType<typeof vi.fn> };
  let cache: { obtenir: ReturnType<typeof vi.fn>; stocker: ReturnType<typeof vi.fn> };
  let service: ServiceNotifications;

  beforeEach(() => {
    depot = {
      listerAbonnesSources: vi.fn().mockResolvedValue([
        { utilisateurId: 'u1', sourceId: 's1', nomSource: 'Le Monde' },
        { utilisateurId: 'u1', sourceId: 's2', nomSource: 'franceinfo' },
        { utilisateurId: 'u2', sourceId: 's1', nomSource: 'Le Monde' },
        { utilisateurId: 'u3', sourceId: 's2', nomSource: 'franceinfo' },
      ]),
      listerAbonnementsPush: vi.fn().mockResolvedValue([
        { utilisateurId: 'u1', abonnement: abonnement('e1') },
        { utilisateurId: 'u1', abonnement: abonnement('e1b') },
        { utilisateurId: 'u2', abonnement: abonnement('e2') },
      ]),
      supprimerAbonnementParEndpoint: vi.fn(),
      listerDestinatairesResume: vi.fn(),
    };
    push = { estConfigure: vi.fn().mockReturnValue(true), envoyer: vi.fn().mockResolvedValue('envoye') };
    cache = { obtenir: vi.fn().mockResolvedValue(null), stocker: vi.fn() };
    service = new ServiceNotifications(depot as never, { listerFilUtilisateur: vi.fn() }, push, { estConfigure: () => false, envoyer: vi.fn() }, cache, { intervallePushS: 900 });
  });

  it('regroupe les nouveautés par utilisateur et envoie un push par appareil', async () => {
    const bilan = await service.notifierNouveauxArticles([{ sourceId: 's1', nouveauxArticles: 3 }, { sourceId: 's2', nouveauxArticles: 2 }, { sourceId: 's3', nouveauxArticles: 0 }]);

    expect(depot.listerAbonnesSources).toHaveBeenCalledWith(['s1', 's2']);
    expect(bilan).toEqual({ utilisateursNotifies: 2, envois: 3, abonnementsExpires: 0 });
    expect(push.envoyer).toHaveBeenCalledWith(abonnement('e1'), expect.objectContaining({ titre: '5 nouveaux articles', corps: 'Le Monde, franceinfo' }));
    expect(push.envoyer).toHaveBeenCalledWith(abonnement('e2'), expect.objectContaining({ titre: '3 nouveaux articles', corps: 'Le Monde' }));
    expect(cache.stocker).toHaveBeenCalledWith('notifications:push:u1', expect.any(Number), { ttl: 900 });
  });

  it('ne renvoie pas de push à un utilisateur prévenu récemment', async () => {
    cache.obtenir.mockImplementation(async (cle: string) => (cle.endsWith('u1') ? Date.now() : null));

    const bilan = await service.notifierNouveauxArticles([{ sourceId: 's1', nouveauxArticles: 1 }]);

    expect(bilan.utilisateursNotifies).toBe(1);
    expect(push.envoyer).toHaveBeenCalledTimes(1);
    expect(push.envoyer).toHaveBeenCalledWith(abonnement('e2'), expect.anything());
  });

  it('supprime les abonnements expirés et ne fait rien sans clés VAPID ni nouveautés', async () => {
    push.envoyer.mockImplementation(async (a: { endpoint: string }) => (a.endpoint === 'e1b' ? 'expire' : 'envoye'));

    const bilan = await service.notifierNouveauxArticles([{ sourceId: 's1', nouveauxArticles: 1 }]);
    expect(bilan.abonnementsExpires).toBe(1);
    expect(depot.supprimerAbonnementParEndpoint).toHaveBeenCalledWith('e1b');

    push.envoyer.mockClear();
    expect(await service.notifierNouveauxArticles([{ sourceId: 's1', nouveauxArticles: 0 }])).toEqual({ utilisateursNotifies: 0, envois: 0, abonnementsExpires: 0 });
    push.estConfigure.mockReturnValue(false);
    await service.notifierNouveauxArticles([{ sourceId: 's1', nouveauxArticles: 5 }]);
    expect(push.envoyer).not.toHaveBeenCalled();
  });
});

describe('ServiceNotifications.envoyerResumes', () => {
  it('envoie un résumé des non-lus de la période à chaque destinataire ayant quelque chose à lire', async () => {
    const maintenant = new Date('2026-10-21T07:00:00Z');
    const depot = {
      listerDestinatairesResume: vi.fn().mockResolvedValue([{ utilisateurId: 'u1', email: 'u1@ex.fr' }, { utilisateurId: 'u2', email: 'u2@ex.fr' }]),
    };
    const listerFilUtilisateur = vi.fn(async (id: string) => ({
      donnees: id === 'u1' ? [article({ titre: 'Un', nomSource: 'Le Monde' })] : [],
      pagination: { page: 1, limite: 30, total: id === 'u1' ? 4 : 0, totalPages: 1 },
    }));
    const courriel = { estConfigure: vi.fn().mockReturnValue(true), envoyer: vi.fn() };
    const service = new ServiceNotifications(depot as never, { listerFilUtilisateur }, { estConfigure: () => false, envoyer: vi.fn() }, courriel, { obtenir: vi.fn(), stocker: vi.fn() }, { urlApp: 'https://news.ex/' });

    const bilan = await service.envoyerResumes('hebdomadaire', maintenant);

    expect(bilan).toEqual({ destinataires: 2, envoyes: 1 });
    expect(listerFilUtilisateur).toHaveBeenCalledWith('u1', expect.objectContaining({ depuis: new Date('2026-10-14T07:00:00Z'), nonLus: true, limite: 30 }));
    expect(courriel.envoyer).toHaveBeenCalledTimes(1);
    const envoye = courriel.envoyer.mock.calls[0]![0];
    expect(envoye.a).toBe('u1@ex.fr');
    expect(envoye.sujet).toBe('Veilleur · 4 articles à lire cette semaine');
    expect(envoye.html).toContain('https://news.ex/?nonLus=1');

    courriel.estConfigure.mockReturnValue(false);
    expect(await service.envoyerResumes('quotidien', maintenant)).toEqual({ destinataires: 0, envoyes: 0 });
  });
});

describe('composerResume', () => {
  it('groupe par source, échappe le HTML et propose un texte brut', () => {
    const articles = [
      article({ titre: 'A <b>gras</b>', nomSource: 'Le Monde', lien: 'https://lemonde.fr/a', resume: 'Résumé' }),
      article({ titre: 'B', nomSource: 'franceinfo', lien: 'https://fi.fr/b' }),
      article({ titre: 'C', nomSource: 'Le Monde', lien: 'https://lemonde.fr/c' }),
    ];
    expect(grouperParSource(articles).map(g => [g.nom, g.articles.length])).toEqual([['Le Monde', 2], ['franceinfo', 1]]);

    const courriel = composerResume({ frequence: 'quotidien', articles, total: 3, urlApp: 'https://news.ex', destinataire: 'moi@ex.fr' });
    expect(courriel.sujet).toBe('Veilleur · 3 articles à lire aujourd\'hui');
    expect(courriel.html).toContain('A &lt;b&gt;gras&lt;/b&gt;');
    expect(courriel.html).toContain('https://news.ex/parametres');
    expect(courriel.texte).toContain('## Le Monde\n- A <b>gras</b>\n  https://lemonde.fr/a');
    expect(echapperHtml('"&')).toBe('&quot;&amp;');
  });
});
